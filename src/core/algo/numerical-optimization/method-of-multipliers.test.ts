/**
 * method-of-multipliers.test.ts - KKT brute-force match, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./method-of-multipliers";
import type { VisualFrame } from "@/types";

function solve(matrix: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const m = matrix.map((row, index) => [...row, rhs[index] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(m[row]![col] ?? 0) > Math.abs(m[pivot]![col] ?? 0)) pivot = row;
        }
        const t = m[col]!;
        m[col] = m[pivot]!;
        m[pivot] = t;
        const div = m[col]![col] ?? 1;
        for (let c = col; c <= n; c += 1) m[col]![c] = (m[col]![c] ?? 0) / div;
        for (let row = 0; row < n; row += 1) {
            if (row === col) continue;
            const factor = m[row]![col] ?? 0;
            for (let c = col; c <= n; c += 1) m[row]![c] = (m[row]![c] ?? 0) - factor * (m[col]![c] ?? 0);
        }
    }
    return m.map((row) => row[n] ?? 0);
}

/** Solve the Karush-Kuhn-Tucker system for an equality-constrained quadratic. */
function kkt(Q: number[][], c: number[], A: number[][], b: number[]): number[] {
    const n = Q.length;
    const m = A.length;
    const kktMatrix: number[][] = Array.from({ length: n + m }, (_, r) =>
        Array.from({ length: n + m }, (_, col) => {
            if (r < n && col < n) return Q[r]![col] ?? 0;
            if (r < n && col >= n) return A[col - n]![r] ?? 0;
            if (r >= n && col < n) return A[r - n]![col] ?? 0;
            return 0;
        }),
    );
    const solution = solve(kktMatrix, [...c, ...b]);
    return solution.slice(0, n);
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Method of Multipliers", () => {
    it("matches the exact Karush-Kuhn-Tucker solution", () => {
        const cases = [
            { Q: [[4, 1], [1, 3]], c: [0, 0], A: [[1, 1]], b: [1] },
            { Q: [[2, 0, 0], [0, 5, 0], [0, 0, 3]], c: [1, -2, 0], A: [[1, 1, 1]], b: [2] },
        ];
        for (const { Q, c, A, b } of cases) {
            const frames = [...mod.run({ Q, c, A, b, rho: 2, iterations: 40, tolerance: 1e-11 })];
            checkFrames(frames, c.length);
            const x = frames[frames.length - 1]!.meta["x"] as number[];
            const expected = kkt(Q, c, A, b);
            x.forEach((value, index) => expect(value).toBeCloseTo(expected[index] ?? 0, 6));
            expect(Number(frames[frames.length - 1]!.meta["residual"])).toBeLessThan(1e-8);
        }
    });

    it("never increases the constraint residual", () => {
        const frames = [...mod.run(mod.defaultInput as object)];
        for (let i = 1; i < frames.length; i += 1) {
            expect(Number(frames[i]!.meta["residual"])).toBeLessThanOrEqual(Number(frames[i - 1]!.meta["residual"]) + 1e-9);
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
