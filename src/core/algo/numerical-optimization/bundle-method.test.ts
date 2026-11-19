/**
 * bundle-method.test.ts - Brute-force optimum, cutting-plane lower bound,
 * serious-step descent, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./bundle-method";
import type { VisualFrame } from "@/types";

function evalFunction(x: number): number {
    return Math.max(2 * x - 2, -x + 1, 0.5 * x - 0.5);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.entities.length).toBe(Number(frame.meta["bundleSize"]));
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("bundle method", () => {
    const input = mod.defaultInput as { start: number; iterations: number; proximity: number };

    it("confirms the optimum by brute-force grid search", () => {
        let minimum = Infinity;
        let argMin = 0;
        for (let i = -2000; i <= 2000; i += 1) {
            const x = i / 1000;
            const value = evalFunction(x);
            if (value < minimum) {
                minimum = value;
                argMin = x;
            }
        }
        expect(minimum).toBeCloseTo(0, 6);
        expect(argMin).toBeCloseTo(1, 2);
    });

    it("keeps each stored cutting plane below the objective", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        // For any cut stored in any frame, its affine plane underestimates f.
        for (const frame of frames) {
            for (const entity of frame.entities) {
                const x0 = Number(entity.metadata["x"]);
                const gradient = Number(entity.metadata["gradient"]);
                const value = Number(entity.value);
                for (let i = -100; i <= 100; i += 1) {
                    const x = i / 10;
                    expect(value + gradient * (x - x0)).toBeLessThanOrEqual(evalFunction(x) + 1e-9);
                }
            }
        }
    });

    it("decreases the center only on serious steps and converges", () => {
        const frames = [...mod.run(input)];
        let previousCenterValue = Number(frames[0]?.meta["fCenter"]);
        for (const frame of frames.slice(1, -1)) {
            const centerValue = Number(frame.meta["fCenter"]);
            if (frame.meta["stepType"] === "serious") {
                expect(centerValue).toBeLessThan(previousCenterValue - 1e-9);
            } else {
                expect(centerValue).toBeCloseTo(previousCenterValue, 10);
            }
            previousCenterValue = centerValue;
        }
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["best"])).toBeLessThan(1e-3);
        expect(Number(final?.["center"])).toBeCloseTo(1, 3);
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
