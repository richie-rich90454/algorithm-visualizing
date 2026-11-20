/**
 * subgradient-method.test.ts - Brute-force optimum, reference recurrence,
 * descent property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./subgradient-method";
import type { VisualFrame } from "@/types";

function evalFunction(x: number, y: number): { value: number; gradient: [number, number] } {
    const pieces: Array<{ value: number; gradient: [number, number] }> = [
        { value: x + y, gradient: [1, 1] },
        { value: -x, gradient: [-1, 0] },
        { value: -y, gradient: [0, -1] },
    ];
    let best = pieces[0]!;
    for (const piece of pieces) {
        if (piece.value > best.value) best = piece;
    }
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThanOrEqual(1);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Polyak subgradient method", () => {
    const input = mod.defaultInput as { start: [number, number]; iterations: number };

    it("confirms the optimum by brute-force grid search", () => {
        let minimum = Infinity;
        let argMin: [number, number] = [0, 0];
        for (let i = -500; i <= 500; i += 1) {
            for (let j = -500; j <= 500; j += 1) {
                const x = i / 100;
                const y = j / 100;
                const value = evalFunction(x, y).value;
                if (value < minimum) {
                    minimum = value;
                    argMin = [x, y];
                }
            }
        }
        expect(minimum).toBeCloseTo(0, 6);
        expect(Math.abs(argMin[0])).toBeLessThan(0.02);
        expect(Math.abs(argMin[1])).toBeLessThan(0.02);
    });

    it("reproduces the reference recurrence at every frame", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        let x = input.start[0];
        let y = input.start[1];
        for (let index = 1; index < frames.length - 1; index += 1) {
            const evaluation = evalFunction(x, y);
            const alpha = evaluation.value / (evaluation.gradient[0] ** 2 + evaluation.gradient[1] ** 2);
            x -= alpha * evaluation.gradient[0];
            y -= alpha * evaluation.gradient[1];
            const meta = frames[index]!.meta;
            expect(Number(meta["x"])).toBeCloseTo(x, 10);
            expect(Number(meta["y"])).toBeCloseTo(y, 10);
            expect(Number(meta["alpha"])).toBeCloseTo(alpha, 10);
            expect(Number(meta["f"])).toBeCloseTo(evalFunction(x, y).value, 10);
            expect(meta["subgradient"]).toEqual(evaluation.gradient);
        }
    });

    it("monotonically improves the best value and converges", () => {
        const frames = [...mod.run(input)];
        let previous = Infinity;
        for (const frame of frames) {
            const best = Number(frame.meta["best"]);
            expect(best).toBeLessThanOrEqual(previous + 1e-12);
            previous = best;
        }
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["best"])).toBeLessThan(1e-3);
        expect(Number(final?.["done"])).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
