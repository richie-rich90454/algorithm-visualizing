/**
 * proximal-point.test.ts - Closed-form reference, contraction, and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./proximal-point";
import type { VisualFrame } from "@/types";

/** Independent closed-form iteration of the proximal map. */
function reference(a: number, c: number, x0: number, gamma: number, iterations: number): number[] {
    const values = [x0];
    for (let i = 0; i < iterations; i += 1) {
        const x = values[values.length - 1] ?? x0;
        values.push((x + gamma * a * c) / (1 + gamma * a));
    }
    return values;
}

/** Check frame shape and termination. */
function checkFrames(frames: VisualFrame[], minBars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThanOrEqual(minBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Proximal Point Algorithm", () => {
    it("matches an independent closed-form iteration", () => {
        const input = { a: 2, c: 5, x0: 0, gamma: 0.5, iterations: 12 };
        const frames = [...mod.run(input)];
        checkFrames(frames, 1);
        const expected = reference(input.a, input.c, input.x0, input.gamma, input.iterations);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["x"])).toBeCloseTo(expected[expected.length - 1] ?? Number.NaN, 12);
        expect(final?.["iterates"]).toEqual(expected);
    });

    it("contracts the gap by the predicted factor and lowers the objective", () => {
        const input = { a: 3, c: -4, x0: 10, gamma: 0.8, iterations: 15 };
        const frames = [...mod.run(input)];
        const factor = 1 / (1 + input.gamma * input.a);
        const updates = frames.slice(1, frames.length - 1);
        let previousGap = Math.abs((frames[0]?.meta["x"] as number) - input.c);
        let previousObjective = Number.POSITIVE_INFINITY;
        for (const frame of updates) {
            const x = Number(frame.meta["x"]);
            const gap = Math.abs(x - input.c);
            expect(gap).toBeCloseTo(previousGap * factor, 9);
            const objective = 0.5 * input.a * (x - input.c) * (x - input.c);
            expect(objective).toBeLessThan(previousObjective);
            previousGap = gap;
            previousObjective = objective;
        }
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["gap"])).toBeLessThan(1e-3);
    });

    it("handles zero iterations without extraneous updates", () => {
        const frames = [...mod.run({ a: 1, c: 2, x0: 9, gamma: 1, iterations: 0 })];
        expect(frames.length).toBe(2);
        expect(frames[frames.length - 1]?.meta["x"]).toBe(9);
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
