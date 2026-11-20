/**
 * hestenes-stiefel.test.ts - Brute-force solution match, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hestenes-stiefel";
import type { VisualFrame } from "@/types";

function solve(A: number[][], b: number[]): number[] {
    const n = b.length;
    const m = A.map((row, index) => [...row, b[index] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(m[row]![col] ?? 0) > Math.abs(m[pivot]![col] ?? 0)) pivot = row;
        }
        const temp = m[col]!;
        m[col] = m[pivot]!;
        m[pivot] = temp;
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

describe("Hestenes-Stiefel Conjugate Gradient", () => {
    it("matches a brute-force linear solve on several systems", () => {
        const cases = [
            { A: [[4, 1], [1, 3]], b: [1, 2] },
            { A: [[5, 1, 0], [1, 4, 1], [0, 1, 3]], b: [1, 2, 3] },
            { A: [[2, 0, 0], [0, 6, 0], [0, 0, 1]], b: [4, -6, 2] },
        ];
        for (const { A, b } of cases) {
            const frames = [...mod.run({ A, b, iterations: 12, tolerance: 1e-11 })];
            checkFrames(frames, b.length);
            const solution = frames[frames.length - 1]!.meta["solution"] as number[];
            const expected = solve(A, b);
            solution.forEach((value, index) => expect(value).toBeCloseTo(expected[index] ?? 0, 7));
            expect(Number(frames[frames.length - 1]!.meta["gradientNorm"])).toBeLessThan(1e-7);
        }
    });

    it("never increases the quadratic objective", () => {
        const frames = [...mod.run({ A: [[4, 1], [1, 3]], b: [1, 2], iterations: 8 })];
        for (let i = 1; i < frames.length; i += 1) {
            expect(Number(frames[i]!.meta["f"])).toBeLessThanOrEqual(Number(frames[i - 1]!.meta["f"]) + 1e-10);
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
