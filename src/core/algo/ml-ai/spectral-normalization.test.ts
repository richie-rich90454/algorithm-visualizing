/**
 * spectral-normalization.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./spectral-normalization";
import type { VisualFrame } from "@/types";

type Input = { matrix: number[][]; iterations: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function matVec(m: number[][], v: number[]): number[] {
    return m.map((row) => row.reduce((a, w, j) => a + w * (v[j] ?? 0), 0));
}

function transpose(m: number[][]): number[][] {
    return m[0]?.map((_, c) => m.map((row) => row[c] ?? 0)) ?? [];
}

function unit(v: number[]): number[] {
    const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0));
    return n > 0 ? v.map((x) => x / n) : v.map(() => 0);
}

function spectralNorm(matrix: number[][]): number {
    const cols = matrix[0]?.length ?? 0;
    let v = unit(new Array<number>(cols).fill(1));
    const t = transpose(matrix);
    let sigma = 0;
    for (let i = 0; i < 500; i += 1) {
        const u = unit(matVec(matrix, v));
        v = unit(matVec(t, u));
        sigma = Math.abs(matVec(matrix, v).reduce((a, x, j) => a + x * (u[j] ?? 0), 0));
    }
    return sigma;
}

describe("Spectral Normalization", () => {
    it("converges to the true spectral norm and normalizes to about one", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = spectralNorm(input.matrix);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["sigma"])).toBeCloseTo(expected, 3);
        expect(Number(final?.["normalizedSpectralNorm"])).toBeCloseTo(1, 3);
        const normalized = final?.["normalized"] as number[];
        expect(normalized.length).toBe(input.matrix.length * (input.matrix[0]?.length ?? 0));
        normalized.forEach((v, i) => {
            const expectedValue = (input.matrix[Math.floor(i / (input.matrix[0]?.length ?? 1))]?.[i % (input.matrix[0]?.length ?? 1)] ?? 0) / expected;
            expect(v).toBeCloseTo(expectedValue, 3);
        });
    });

    it("produces monotonically non-decreasing estimates across iterations", () => {
        const frames = [...mod.run({ matrix: [[3, 1], [1, 2]], iterations: 8 })];
        const estimates = frames.filter((f) => typeof f.meta["estimate"] === "number").map((f) => Number(f.meta["estimate"]));
        expect(estimates.length).toBe(8);
        for (let i = 1; i < estimates.length; i += 1) {
            expect(estimates[i] ?? 0).toBeGreaterThanOrEqual((estimates[i - 1] ?? 0) - 1e-6);
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
