/**
 * cochran-q-test.test.ts - Independent Q computation, known value,
 * zero-effect case, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cochran-q-test";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number, k: number): void {
    expect(frames.length).toBe(n + 4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * k);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeTypeOf("object");
    });
}

function reference(matrix: number[][]): number {
    const n = matrix.length;
    const k = n > 0 ? matrix[0].length : 0;
    if (n === 0 || k < 2) {
        return 0;
    }
    const columnTotals = Array.from({ length: k }, (_, j) =>
        matrix.reduce((sum, row) => sum + (row[j] ?? 0), 0),
    );
    const total = columnTotals.reduce((sum, value) => sum + value, 0);
    let sumColSquares = 0;
    for (const value of columnTotals) {
        sumColSquares += value * value;
    }
    const numerator = (k - 1) * (k * sumColSquares - total * total);
    let sumRows = 0;
    let sumRowSquares = 0;
    for (const row of matrix) {
        const rowTotal = row.reduce((sum, value) => sum + value, 0);
        sumRows += rowTotal;
        sumRowSquares += rowTotal * rowTotal;
    }
    const denominator = k * sumRows - sumRowSquares;
    return denominator > 0 ? Math.max(0, numerator / denominator) : 0;
}

describe("CochranQTest", () => {
    it("matches an independent Q computation", () => {
        const subjects = [
            [1, 0, 0],
            [1, 0, 0],
            [0, 1, 0],
            [0, 1, 1],
            [1, 0, 1],
            [0, 0, 1],
        ];
        const frames = [...mod.run({ subjects })];
        checkFrames(frames, subjects.length, 3);
        const final = frames[frames.length - 1];
        expect(Number(final.meta["Q"])).toBeCloseTo(reference(subjects), 12);
        expect(Number(final.meta["df"])).toBe(2);
    });

    it("gives zero for identical treatment columns", () => {
        const subjects = [
            [1, 1, 1],
            [0, 0, 0],
            [1, 1, 1],
            [0, 0, 0],
        ];
        const final = [...mod.run({ subjects })].at(-1);
        expect(Number(final?.meta["Q"])).toBeCloseTo(0, 12);
    });

    it("reproduces a hand-worked example", () => {
        const subjects = [
            [1, 1, 0],
            [1, 0, 0],
            [0, 0, 1],
        ];
        const final = [...mod.run({ subjects })].at(-1);
        expect(Number(final?.meta["Q"])).toBeCloseTo(2 / 3, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(9);
        expect(generator.next().done).toBe(true);
    });
});
