/**
 * cgs.test.ts - Direct-solve cross-check, residual consistency, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cgs";
import type { VisualFrame } from "@/types";

function matrix(n: number): number[][] {
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 5 : j === i - 1 ? -1 : j === i + 1 ? -2 : 0)),
    );
}

function solve(a: number[][], b: number[]): number[] {
    const n = b.length;
    const m = a.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col += 1) {
        let pivotRow = col;
        for (let i = col + 1; i < n; i += 1) if (Math.abs(m[i]![col]!) > Math.abs(m[pivotRow]![col]!)) pivotRow = i;
        [m[col], m[pivotRow]] = [m[pivotRow]!, m[col]!];
        const pivot = m[col]![col]!;
        for (let j = col; j <= n; j += 1) m[col]![j] = m[col]![j]! / pivot;
        for (let i = 0; i < n; i += 1) {
            if (i === col) continue;
            const f = m[i]![col]!;
            for (let j = col; j <= n; j += 1) m[i]![j] = m[i]![j]! - f * m[col]![j]!;
        }
    }
    return m.map((row) => row[n]!);
}

function residual(a: number[][], b: number[], x: number[]): number {
    let sum = 0;
    for (let i = 0; i < b.length; i += 1) {
        const ri = b[i]! - a[i]!.reduce((s, v, j) => s + v * x[j]!, 0);
        sum += ri * ri;
    }
    return Math.sqrt(sum);
}

function checkFrames(frames: VisualFrame[], iterations: number): void {
    expect(frames.length).toBeLessThanOrEqual(iterations + 2);
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["cols"]).toBe(6);
        expect(frame.meta["n"]).toBeGreaterThanOrEqual(2);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        frame.entities.forEach((e) => expect(Number.isFinite(e.value as number)).toBe(true));
    });
}

describe("ConjugateGradientSquared", () => {
    it("solves nonsymmetric systems to a direct-solve reference", () => {
        for (const n of [3, 5, 6, 8]) {
            const frames = [...mod.run({ n, iterations: 30 })];
            checkFrames(frames, 30);
            const final = frames[frames.length - 1]?.meta;
            const a = matrix(n);
            const b = Array.from({ length: n }, (_, i) => i + 1);
            const expected = solve(a, b);
            const x = final?.["solution"] as number[];
            expect(x.length).toBe(n);
            x.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 6));
            expect(residual(a, b, x)).toBeLessThan(1e-8);
            expect(final?.["error"] as number).toBeLessThan(1e-7);
        }
    });

    it("reports a residual consistent with the returned iterate", () => {
        const frames = [...mod.run({ n: 6, iterations: 10 })];
        const final = frames[frames.length - 1]?.meta;
        const a = matrix(6);
        const b = Array.from({ length: 6 }, (_, i) => i + 1);
        expect(residual(a, b, final?.["solution"] as number[])).toBeCloseTo(final?.["residual"] as number, 8);
    });

    it("keeps all intermediate quantities finite", () => {
        const frames = [...mod.run({ n: 7, iterations: 20 })];
        for (const frame of frames) {
            expect(Number.isFinite(frame.meta["residual"] as number)).toBe(true);
            expect(Number.isFinite(frame.meta["error"] as number)).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThanOrEqual(2);
        expect(frames[frames.length - 1]?.stepNumber).toBe(frames.length - 1);
        expect(generator.next().done).toBe(true);
    });
});
