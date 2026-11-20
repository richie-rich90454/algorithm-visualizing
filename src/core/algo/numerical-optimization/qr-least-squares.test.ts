/**
 * qr-least-squares.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./qr-least-squares";
import type { VisualFrame } from "@/types";

/** Independent least-squares oracle via normal equations and Gaussian elimination. */
function normalEquations(matrix: number[][], rhs: number[]): number[] {
    const m = matrix.length;
    const n = matrix[0]?.length ?? 0;
    const ata = Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
    const atb = Array.from({ length: n }, () => 0);
    for (let col = 0; col < n; col += 1) {
        for (let row = 0; row < m; row += 1) {
            atb[col] += (matrix[row]?.[col] ?? 0) * (rhs[row] ?? 0);
            for (let other = 0; other < n; other += 1) {
                ata[col]![other] += (matrix[row]?.[col] ?? 0) * (matrix[row]?.[other] ?? 0);
            }
        }
    }
    const augmented = ata.map((row, index) => [...row, atb[index] ?? 0]);
    for (let pivot = 0; pivot < n; pivot += 1) {
        let best = pivot;
        for (let row = pivot + 1; row < n; row += 1) {
            if (Math.abs(augmented[row]?.[pivot] ?? 0) > Math.abs(augmented[best]?.[pivot] ?? 0)) {
                best = row;
            }
        }
        const swap = augmented[pivot]!;
        augmented[pivot] = augmented[best]!;
        augmented[best] = swap;
        const divisor = augmented[pivot]![pivot] ?? 1;
        for (let col = pivot; col <= n; col += 1) {
            augmented[pivot]![col] = (augmented[pivot]![col] ?? 0) / divisor;
        }
        for (let row = 0; row < n; row += 1) {
            if (row === pivot) {
                continue;
            }
            const factor = augmented[row]![pivot] ?? 0;
            for (let col = pivot; col <= n; col += 1) {
                augmented[row]![col] = (augmented[row]![col] ?? 0) - factor * (augmented[pivot]![col] ?? 0);
            }
        }
    }
    return augmented.map((row) => row[n] ?? 0);
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("QR Least Squares", () => {
    it("matches an independent normal-equations solution", () => {
        const input = mod.defaultInput as { matrix: number[][]; rhs: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.matrix.length, (input.matrix[0]?.length ?? 0) + 1);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["done"]).toBe(true);
        const solution = last?.["solution"] as number[];
        const expected = normalEquations(input.matrix, input.rhs);
        expect(solution).toHaveLength(expected.length);
        for (let index = 0; index < expected.length; index += 1) {
            expect(solution[index]).toBeCloseTo(expected[index] as number, 8);
        }
    });

    it("leaves a residual orthogonal to every column of A", () => {
        const input = mod.defaultInput as { matrix: number[][]; rhs: number[] };
        const frames = [...mod.run(input)];
        const solution = frames[frames.length - 1]?.meta["solution"] as number[];
        const n = solution.length;
        for (let col = 0; col < n; col += 1) {
            let correlation = 0;
            for (let row = 0; row < input.matrix.length; row += 1) {
                let predicted = 0;
                for (let other = 0; other < n; other += 1) {
                    predicted += (input.matrix[row]?.[other] ?? 0) * (solution[other] as number);
                }
                correlation += (input.matrix[row]?.[col] ?? 0) * (predicted - (input.rhs[row] ?? 0));
            }
            expect(Math.abs(correlation)).toBeLessThan(1e-8);
        }
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
