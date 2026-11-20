/**
 * svd-one-sided-jacobi.test.ts - Reconstruction/orthonormality property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./svd-one-sided-jacobi";
import type { VisualFrame } from "@/types";

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

function reshape(flat: number[], rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, (_, r) => flat.slice(r * cols, r * cols + cols));
}

describe("One-Sided Jacobi SVD", () => {
    it("reconstructs the matrix and returns orthonormal factors", () => {
        const matrices = [
            [
                [1, 2],
                [3, 4],
                [5, 6],
            ],
            [
                [3, 1, 0],
                [1, 3, 1],
                [0, 1, 4],
                [2, 0, 1],
            ],
        ];
        for (const matrix of matrices) {
            const cols = matrix[0]!.length;
            const frames = [...mod.run({ matrix, sweeps: 20, tolerance: 1e-13 })];
            checkFrames(frames, cols);
            const meta = frames[frames.length - 1]!.meta;
            const U = reshape(meta["U"] as number[], matrix.length, cols);
            const V = reshape(meta["V"] as number[], cols, cols);
            const sigma = meta["singularValues"] as number[];
            expect(sigma.length).toBe(cols);
            expect(Number(meta["reconstructionError"])).toBeLessThan(1e-8);
            expect(Number(meta["orthogonalityError"])).toBeLessThan(1e-8);

            for (let r = 0; r < matrix.length; r += 1) {
                for (let c = 0; c < cols; c += 1) {
                    let sum = 0;
                    for (let k = 0; k < cols; k += 1) sum += U[r]![k]! * sigma[k]! * V[c]![k]!;
                    expect(sum).toBeCloseTo(matrix[r]![c]!, 6);
                }
            }
            for (let a = 0; a < cols; a += 1) {
                for (let b = 0; b < cols; b += 1) {
                    let sum = 0;
                    for (let k = 0; k < matrix.length; k += 1) sum += U[k]![a]! * U[k]![b]!;
                    expect(sum).toBeCloseTo(a === b ? 1 : 0, 6);
                }
            }
            for (let k = 1; k < sigma.length; k += 1) {
                expect(sigma[k]!).toBeLessThanOrEqual((sigma[k - 1] as number) + 1e-9);
            }
        }
    });

    it("yields nonnegative singular values", () => {
        const frames = [...mod.run(mod.defaultInput as object)];
        const sigma = frames[frames.length - 1]!.meta["singularValues"] as number[];
        expect(sigma.every((value) => value >= 0)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
