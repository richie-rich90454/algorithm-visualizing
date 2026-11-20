/**
 * jacobi-iteration.test.ts - Residual and Gaussian-elimination checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./jacobi-iteration";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * (n + 2));
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(n + 2);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Solve a small dense system independently with Gaussian elimination. */
function gaussian(matrix: number[][], rhs: number[]): number[] {
    const n = matrix.length;
    const a = matrix.map((row, i) => [...row, rhs[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(a[row]?.[col] ?? 0) > Math.abs(a[pivot]?.[col] ?? 0)) {
                pivot = row;
            }
        }
        const temp = a[col];
        a[col] = a[pivot] ?? [];
        a[pivot] = temp ?? [];
        const divisor = a[col]?.[col] ?? 1;
        for (let j = col; j <= n; j += 1) {
            a[col]![j] = (a[col]![j] ?? 0) / divisor;
        }
        for (let row = 0; row < n; row += 1) {
            if (row === col) {
                continue;
            }
            const factor = a[row]?.[col] ?? 0;
            for (let j = col; j <= n; j += 1) {
                a[row]![j] = (a[row]![j] ?? 0) - factor * (a[col]![j] ?? 0);
            }
        }
    }
    return a.map((row) => row[n] ?? 0);
}

function maxError(left: number[], right: number[]): number {
    return Math.max(...left.map((value, i) => Math.abs(value - (right[i] ?? 0))));
}

describe("JacobiIteration", () => {
    it("converges to the Gaussian-elimination solution for diagonally dominant systems", () => {
        const systems: Array<{ a: number[][]; b: number[] }> = [
            { a: [[4, 1], [1, 3]], b: [1, 2] },
            { a: [[5, 1, 1], [1, 6, 2], [1, 1, 7]], b: [7, 9, 11] },
            { a: [[10, 2], [1, 8]], b: [12, 9] },
        ];
        for (const system of systems) {
            const frames = [...mod.run({ ...system, iterations: 100 })];
            checkFrames(frames, system.a.length);
            const meta = frames[frames.length - 1]?.meta;
            const expected = gaussian(system.a, system.b);
            expect(maxError(meta?.["solution"] as number[], expected)).toBeLessThan(1e-8);
            expect(Number(meta?.["residual"])).toBeLessThan(1e-8);
            expect(meta?.["converged"]).toBe(true);
        }
    });

    it("uses only the previous iterate on every sweep", () => {
        const a = [[4, 1], [1, 3]];
        const b = [1, 2];
        const first = [...mod.run({ a, b, iterations: 1 })];
        checkFrames(first, 2);
        const firstMeta = first[first.length - 1]?.meta;
        // First sweep: x = 1/4 = 0.25 and y = 2/3 = 0.6667.
        expect(firstMeta?.["solution"]).toEqual([0.25, 2 / 3]);
    });

    it("stops safely on a zero diagonal", () => {
        const frames = [...mod.run({ a: [[0, 1], [1, 3]], b: [1, 2], iterations: 5 })];
        checkFrames(frames, 2);
        expect(frames.length).toBe(2);
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
