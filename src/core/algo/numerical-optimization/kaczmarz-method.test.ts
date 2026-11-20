/**
 * kaczmarz-method.test.ts - Gaussian-elimination cross-check, projection property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { kaczmarz, residualNorm } from "./kaczmarz-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["cols"]).toBe(n);
    });
}

/** Independent reference: solve Ax=b by Gaussian elimination with partial pivoting. */
function gaussianSolve(matrix: number[][], b: number[]): number[] {
    const n = b.length;
    const a = matrix.map((row, i) => [...row, b[i] as number]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(a[r]?.[col] as number) > Math.abs(a[pivot]?.[col] as number)) {
                pivot = r;
            }
        }
        const temp = a[col] as number[];
        a[col] = a[pivot] as number[];
        a[pivot] = temp;
        const pivotValue = a[col]?.[col] as number;
        for (let c = col; c <= n; c += 1) {
            a[col]![c] = (a[col]?.[c] as number) / pivotValue;
        }
        for (let r = 0; r < n; r += 1) {
            if (r === col) {
                continue;
            }
            const factor = a[r]?.[col] as number;
            for (let c = col; c <= n; c += 1) {
                a[r]![c] = (a[r]?.[c] as number) - factor * (a[col]?.[c] as number);
            }
        }
    }
    return a.map((row) => row[n] as number);
}

describe("Kaczmarz method", () => {
    it("matches Gaussian elimination on well-conditioned systems", () => {
        const systems = [
            { A: [[2, 1], [1, 3]], b: [5, 10] },
            { A: [[4, 1, 1], [1, 5, 1], [1, 1, 6]], b: [9, 11, 14] },
            { A: [[3, -1, 2], [1, 4, -1], [2, 1, 5]], b: [7, 4, 12] },
        ];
        for (const system of systems) {
            const reference = gaussianSolve(system.A, system.b);
            const result = kaczmarz(system.A, system.b, 600);
            result.x.forEach((value, index) => {
                expect(value).toBeCloseTo(reference[index] as number, 6);
            });
            expect(result.residual).toBeLessThan(1e-8);
        }
    });

    it("each row projection satisfies that row exactly", () => {
        const matrix = [[2, 1], [1, 3]];
        const b = [5, 10];
        const result = kaczmarz(matrix, b, 10);
        for (const step of result.history) {
            const row = matrix[step.row] as number[];
            const dot = row.reduce((sum, coefficient, j) => sum + coefficient * (step.x[j] as number), 0);
            expect(dot).toBeCloseTo(b[step.row] as number, 10);
        }
    });

    it("residual decreases over the run", () => {
        const result = kaczmarz([[4, 1, 1], [1, 5, 1], [1, 1, 6]], [9, 11, 14], 60);
        expect(result.history[result.history.length - 1]?.residual as number).toBeLessThan(result.history[0]?.residual as number);
        expect(result.residual).toBeCloseTo(residualNorm([[4, 1, 1], [1, 5, 1], [1, 1, 6]], [9, 11, 14], result.x), 10);
    });

    it("skips zero-norm rows without dividing by zero", () => {
        const result = kaczmarz([[0, 0], [1, 1]], [0, 4], 5);
        expect(Number.isFinite(result.x[0] as number)).toBe(true);
        expect(Number.isFinite(result.x[1] as number)).toBe(true);
    });

    it("emits a converged final frame", () => {
        const frames = [...mod.run({ matrix: [[2, 1], [1, 3]], b: [5, 10], iterations: 60 })];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["residual"])).toBeLessThan(1e-4);
        const x = final?.["x"] as number[];
        expect(x[0]).toBeCloseTo(1, 3);
        expect(x[1]).toBeCloseTo(3, 3);
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
