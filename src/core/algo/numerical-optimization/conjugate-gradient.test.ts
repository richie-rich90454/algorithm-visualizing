/**
 * conjugate-gradient.test.ts - Direct-solve cross-check, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./conjugate-gradient";
import type { VisualFrame } from "@/types";

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0));
}

/** Solve A x = b by Gaussian elimination with partial pivoting. */
function gaussianSolve(A: number[][], b: number[]): number[] {
    const n = A.length;
    const a = A.map((row, index) => [...row, b[index]!]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(a[row]![col]!) > Math.abs(a[pivot]![col]!)) pivot = row;
        }
        const tmp = a[col]!;
        a[col] = a[pivot]!;
        a[pivot] = tmp;
        const divisor = a[col]![col]!;
        for (let j = col; j <= n; j += 1) a[col]![j] = a[col]![j]! / divisor;
        for (let row = 0; row < n; row += 1) {
            if (row === col) continue;
            const factor = a[row]![col]!;
            for (let j = col; j <= n; j += 1) a[row]![j] = a[row]![j]! - factor * a[col]![j]!;
        }
    }
    return a.map((row) => row[n]!);
}

function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 48271) + 11) >>> 0;
        return state / 0x100000000;
    };
}

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

describe("Conjugate Gradient", () => {
    it("matches a direct Gaussian solve on random symmetric positive definite systems", () => {
        const random = makeRandom(31);
        for (let trial = 0; trial < 120; trial += 1) {
            const n = 2 + Math.floor(random() * 3);
            const M = Array.from({ length: n }, () =>
                Array.from({ length: n }, () => Math.floor(random() * 5) - 2),
            );
            const A = Array.from({ length: n }, (_, i) =>
                Array.from({ length: n }, (_, j) => {
                    let sum = 0;
                    for (let k = 0; k < n; k += 1) sum += M[k]![i]! * M[k]![j]!;
                    return sum + (i === j ? n : 0);
                }),
            );
            const b = Array.from({ length: n }, () => Math.floor(random() * 11) - 5);
            const frames = [...mod.run({ A, b, iterations: 60, tolerance: 1e-12 })];
            checkFrames(frames, n);
            const finalMeta = frames[frames.length - 1]!.meta;
            const solution = finalMeta["solution"] as number[];
            const expected = gaussianSolve(A, b);
            for (let i = 0; i < n; i += 1) {
                expect(solution[i]!).toBeCloseTo(expected[i]!, 6);
            }
            expect(finalMeta["converged"]).toBe(true);

            const Ax = matVec(A, solution);
            const residual = Math.sqrt(
                Ax.reduce((sum, value, index) => sum + (value - b[index]!) ** 2, 0),
            );
            expect(Number(finalMeta["residual"])).toBeCloseTo(residual, 4);
            expect(residual).toBeLessThan(1e-6);
        }
    });

    it("solves the default two by two system", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const solution = frames[frames.length - 1]!.meta["solution"] as number[];
        expect(solution[0]!).toBeCloseTo(1 / 11, 6);
        expect(solution[1]!).toBeCloseTo(7 / 11, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
