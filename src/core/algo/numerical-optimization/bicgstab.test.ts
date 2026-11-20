/**
 * bicgstab.test.ts - Independent Gaussian elimination reference, residual
 * property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./bicgstab";
import type { VisualFrame } from "@/types";

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
}

function residual(a: number[][], b: number[], x: number[]): number {
    return Math.sqrt(
        b.reduce((sum, value, i) => {
            const diff = value - dot(a[i] ?? [], x);
            return sum + diff * diff;
        }, 0),
    );
}

/** Independent dense solver by Gaussian elimination with partial pivoting. */
function gaussian(a: number[][], b: number[]): number[] {
    const n = b.length;
    const m = a.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let i = col + 1; i < n; i += 1) {
            if (Math.abs(m[i]![col] ?? 0) > Math.abs(m[pivot]![col] ?? 0)) {
                pivot = i;
            }
        }
        [m[col], m[pivot]] = [m[pivot]!, m[col]!];
        for (let i = col + 1; i < n; i += 1) {
            const factor = (m[i]![col] ?? 0) / (m[col]![col] ?? 1);
            for (let j = col; j <= n; j += 1) {
                m[i]![j] = (m[i]![j] ?? 0) - factor * (m[col]![j] ?? 0);
            }
        }
    }
    const x = new Array<number>(n).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
        let sum = m[i]![n] ?? 0;
        for (let j = i + 1; j < n; j += 1) {
            sum -= (m[i]![j] ?? 0) * (x[j] ?? 0);
        }
        x[i] = sum / (m[i]![i] ?? 1);
    }
    return x;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("BiCGSTAB", () => {
    it("matches Gaussian elimination on several dense systems", () => {
        const systems: Array<{ a: number[][]; b: number[] }> = [
            { a: [[4, 1], [1, 3]], b: [1, 2] },
            { a: [[3, 1, 0], [1, 4, 1], [0, 1, 5]], b: [1, 2, 3] },
            { a: [[2, -1], [-1, 2]], b: [0, 3] },
        ];
        for (const { a, b } of systems) {
            const frames = [...mod.run({ a, b, maxIter: 100, tol: 1e-9 })];
            checkFrames(frames, b.length);
            const final = frames[frames.length - 1]?.meta;
            const x = final?.["solution"] as number[];
            const expected = gaussian(a, b);
            for (let i = 0; i < b.length; i += 1) {
                expect(x[i]).toBeCloseTo(expected[i]!, 8);
            }
            expect(final?.["converged"]).toBe(true);
            expect(Number(final?.["residual"])).toBeLessThan(1e-9);
        }
    });

    it("reports residuals that match an independent recomputation", () => {
        const input = mod.defaultInput as { a: number[][]; b: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.b.length);
        for (const frame of frames) {
            const x = frame.meta["solution"] as number[];
            const reported = Number(frame.meta["residual"]);
            expect(reported).toBeCloseTo(residual(input.a, input.b, x), 10);
        }
        const history = frames[frames.length - 1]?.meta["residualHistory"] as number[];
        expect(history.length).toBeGreaterThan(1);
        expect(history[history.length - 1]!).toBeLessThan(history[0]!);
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
