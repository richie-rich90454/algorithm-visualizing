/**
 * l-bfgs.test.ts - Exact-minimizer check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./l-bfgs";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Solve Hx = b directly by Gaussian elimination for an independent answer. */
function exactMinimizer(H: number[][], b: number[]): number[] {
    const n = H.length;
    const aug = H.map((row, i) => [...row, b[i]!]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(aug[r]![col]!) > Math.abs(aug[pivot]![col]!)) pivot = r;
        }
        [aug[col], aug[pivot]] = [aug[pivot]!, aug[col]!];
        const div = aug[col]![col]!;
        for (let c = col; c <= n; c += 1) aug[col]![c] = aug[col]![c]! / div;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const factor = aug[r]![col]!;
            for (let c = col; c <= n; c += 1) aug[r]![c] = aug[r]![c]! - factor * aug[col]![c]!;
        }
    }
    return aug.map((row) => row[n]!);
}

function objective(H: number[][], b: number[], x: number[]): number {
    let f = 0;
    for (let i = 0; i < H.length; i += 1) {
        for (let j = 0; j < H.length; j += 1) f += 0.5 * x[i]! * H[i]![j]! * x[j]!;
        f -= b[i]! * x[i]!;
    }
    return f;
}

describe("L-BFGS", () => {
    it("converges to the exact quadratic minimizer", () => {
        const H = [[4, 1], [1, 3]];
        const b = [1, 2];
        const frames = [...mod.run({ H, b, x0: [0, 0], m: 5, maxIterations: 200, tolerance: 1e-11 })];
        checkFrames(frames, 2);
        const meta = frames[frames.length - 1]!.meta;
        const expected = exactMinimizer(H, b);
        const x = meta["x"] as number[];
        expect(x[0]).toBeCloseTo(expected[0]!, 8);
        expect(x[1]).toBeCloseTo(expected[1]!, 8);
        expect(Number(meta["gradNorm"])).toBeLessThan(1e-8);
        expect(meta["converged"]).toBe(true);
    });

    it("beats the starting objective on several well-conditioned quadratics", () => {
        const cases: Array<{ H: number[][]; b: number[] }> = [
            { H: [[3, 0], [0, 5]], b: [6, 10] },
            { H: [[6, 2], [2, 4]], b: [2, 8] },
            { H: [[10, 1, 0], [1, 8, 1], [0, 1, 6]], b: [1, 2, 3] },
        ];
        for (const { H, b } of cases) {
            const n = H.length;
            const frames = [...mod.run({ H, b, x0: Array.from({ length: n }, () => 0), m: 4, maxIterations: 300, tolerance: 1e-10 })];
            checkFrames(frames, n);
            const meta = frames[frames.length - 1]!.meta;
            const optimum = exactMinimizer(H, b);
            const x = meta["x"] as number[];
            for (let i = 0; i < n; i += 1) expect(x[i]).toBeCloseTo(optimum[i]!, 7);
            expect(Number(meta["f"])).toBeLessThanOrEqual(objective(H, b, Array.from({ length: n }, () => 0)) + 1e-12);
        }
    });

    it("objective is nonincreasing across frames", () => {
        const frames = [...mod.run(mod.defaultInput)];
        for (let i = 1; i < frames.length; i += 1) {
            expect(Number(frames[i]!.meta["f"])).toBeLessThanOrEqual(Number(frames[i - 1]!.meta["f"]) + 1e-12);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
