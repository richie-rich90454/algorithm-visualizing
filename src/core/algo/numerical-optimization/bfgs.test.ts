/**
 * bfgs.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./bfgs";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], d: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(d);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

/** Brute-force 2x2 system solve, independent of the module. */
function solve2(A: number[][], b: number[]): [number, number] {
    const [a, bb] = [A[0]![0]!, A[0]![1]!];
    const [c, d] = [A[1]![0]!, A[1]![1]!];
    const det = a * d - bb * c;
    return [(d * b[0]! - bb * b[1]!) / det, (-c * b[0]! + a * b[1]!) / det];
}

describe("BFGS", () => {
    it("finds the closed-form minimizer on the default quadratic", () => {
        const input = mod.defaultInput as {
            A: number[][];
            b: number[];
            c: number;
            start: number[];
            iterations: number;
            tolerance: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, 2);
        const [x1, x2] = solve2(input.A, input.b);
        const metaFrame = finalMeta(frames);
        const x = metaFrame["x"] as number[];
        expect(metaFrame["converged"]).toBe(true);
        expect(x[0]).toBeCloseTo(x1, 5);
        expect(x[1]).toBeCloseTo(x2, 5);
        expect(metaFrame["gradNorm"] as number).toBeLessThan(1e-6);
    });

    it("converges on a non-diagonal quadratic", () => {
        const A = [
            [4, 1],
            [1, 2],
        ];
        const b = [3, 5];
        const frames = [...mod.run({ A, b, c: 0, start: [10, -10], iterations: 60, tolerance: 1e-8 })];
        checkFrames(frames, 2);
        const [x1, x2] = solve2(A, b);
        const metaFrame = finalMeta(frames);
        const x = metaFrame["x"] as number[];
        expect(metaFrame["converged"]).toBe(true);
        expect(x[0]).toBeCloseTo(x1, 5);
        expect(x[1]).toBeCloseTo(x2, 5);
    });

    it("decreases the function value monotonically and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        let previous = Number.POSITIVE_INFINITY;
        let count = 0;
        for (const frame of generator) {
            count += 1;
            const fx = Number(frame.meta["fx"]);
            expect(fx).toBeLessThanOrEqual(previous + 1e-8);
            previous = fx;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
