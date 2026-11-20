/**
 * proximal-gradient.test.ts - Closed-form solution, recurrence, monotonic objective, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./proximal-gradient";
import type { VisualFrame } from "@/types";

function soft(x: number, t: number): number {
    return x > t ? x - t : x < -t ? x + t : 0;
}

function objective(x: number, a: number, lambda: number): number {
    return 0.5 * (x - a) * (x - a) + lambda * Math.abs(x);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Proximal gradient (L1)", () => {
    it("reaches the closed-form soft-threshold solution", () => {
        const cases: Array<{ a: number; lambda: number }> = [
            { a: 3, lambda: 1 },
            { a: -2.5, lambda: 0.7 },
            { a: 0.4, lambda: 1 },
            { a: 10, lambda: 3.2 },
            { a: -1, lambda: 0 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ ...testCase, step: 0.5, iterations: 60 })];
            checkFrames(frames);
            const last = frames[frames.length - 1]?.meta;
            const want = soft(testCase.a, testCase.lambda);
            expect(Number(last?.["x"])).toBeCloseTo(want, 8);
            expect(Number(last?.["optimum"])).toBeCloseTo(want, 12);
            expect(Number(last?.["error"])).toBeLessThan(1e-6);
        }
    });

    it("every iterate matches an independent recurrence and the objective never rises", () => {
        const a = 3;
        const lambda = 1;
        const step = 0.5;
        const frames = [...mod.run({ a, lambda, step, iterations: 12, x0: 3 })];
        checkFrames(frames);
        let previousX = 3;
        let previousObjective = objective(previousX, a, lambda);
        for (let k = 1; k < frames.length - 1; k += 1) {
            const intermediate = previousX - step * (previousX - a);
            const next = soft(intermediate, step * lambda);
            const meta = frames[k]?.meta;
            expect(Number(meta?.["intermediate"])).toBeCloseTo(intermediate, 12);
            expect(Number(meta?.["x"])).toBeCloseTo(next, 12);
            const current = Number(meta?.["objective"]);
            expect(current).toBeLessThanOrEqual(previousObjective + 1e-12);
            previousX = next;
            previousObjective = current;
        }
    });

    it("produces exact sparsity when lambda exceeds the signal", () => {
        const frames = [...mod.run({ a: 0.4, lambda: 1, step: 1, iterations: 5 })];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["x"])).toBe(0);
        expect(Number(last?.["optimum"])).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
