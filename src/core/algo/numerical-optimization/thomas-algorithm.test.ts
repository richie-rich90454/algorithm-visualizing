/**
 * thomas-algorithm.test.ts - Brute-force dense-system cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./thomas-algorithm";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * 5);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["cols"]).toBe(5);
    });
}

function gaussianSolve(a: number[][], b: number[]): number[] {
    const n = b.length;
    const m = a.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let p = col;
        for (let r = col + 1; r < n; r += 1) if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[p]?.[col] ?? 0)) p = r;
        const t = m[col] as number[];
        m[col] = m[p] as number[];
        m[p] = t;
        const d = m[col]?.[col] ?? 0;
        for (let r = col + 1; r < n; r += 1) {
            const f = (m[r]?.[col] ?? 0) / d;
            for (let c = col; c <= n; c += 1) m[r]![c] = (m[r]?.[c] ?? 0) - f * (m[col]?.[c] ?? 0);
        }
    }
    const x = Array.from({ length: n }, () => 0);
    for (let i = n - 1; i >= 0; i -= 1) {
        let s = m[i]?.[n] ?? 0;
        for (let j = i + 1; j < n; j += 1) s -= (m[i]?.[j] ?? 0) * (x[j] ?? 0);
        x[i] = s / (m[i]?.[i] ?? 1);
    }
    return x;
}

function dense(lower: number[], main: number[], upper: number[]): number[][] {
    const n = main.length;
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (j === i ? main[i] ?? 0 : j === i - 1 ? lower[i - 1] ?? 0 : j === i + 1 ? upper[i] ?? 0 : 0)),
    );
}

describe("Thomas algorithm", () => {
    it("solves the default system and matches a dense reference", () => {
        const input = mod.defaultInput as { lower: number[]; main: number[]; upper: number[]; rhs: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.main.length);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["failed"]).toBe(false);
        const x = last?.["solution"] as number[];
        x.forEach((value, i) => expect(value).toBeCloseTo(i + 1, 6));
        const expected = gaussianSolve(dense(input.lower, input.main, input.upper), input.rhs);
        x.forEach((value, i) => expect(value).toBeCloseTo(expected[i] ?? 0, 6));
    });

    it("matches a dense solve on randomly generated diagonally dominant systems", () => {
        const cases: Array<{ lower: number[]; main: number[]; upper: number[]; rhs: number[] }> = [
            { lower: [-2, -2, -2], main: [7, 7, 7, 7], upper: [-1, -1, -1], rhs: [4, 2, 9, 6] },
            { lower: [1, 1, 1, 1], main: [6, 6, 6, 6, 6], upper: [2, 2, 2, 2], rhs: [10, 4, 7, 3, 12] },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.main.length);
            const last = frames[frames.length - 1]?.meta;
            expect(last?.["failed"]).toBe(false);
            const x = last?.["solution"] as number[];
            const expected = gaussianSolve(dense(input.lower, input.main, input.upper), input.rhs);
            x.forEach((value, i) => expect(value).toBeCloseTo(expected[i] ?? 0, 6));
            expect(last?.["residual"] as number).toBeLessThan(1e-8);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
