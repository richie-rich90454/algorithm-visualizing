/**
 * partial-autocorrelation.test.ts - Brute-force OLS cross-check, AR(1) behavior, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./partial-autocorrelation";
import type { VisualFrame } from "@/types";

/** Solve a small dense linear system by Gauss-Jordan elimination. */
function solve(matrix: number[][], right: number[]): number[] {
    const n = right.length;
    const rows = matrix.map((row, index) => [...row, right[index]]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
        }
        const swap = rows[col];
        rows[col] = rows[pivot];
        rows[pivot] = swap;
        const diagonal = rows[col][col];
        for (let c = col; c <= n; c += 1) rows[col][c] /= diagonal;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const factor = rows[r][col];
            for (let c = col; c <= n; c += 1) rows[r][c] -= factor * rows[col][c];
        }
    }
    return rows.map((row) => row[n]);
}

/** Brute-force partial autocorrelation by solving the Toeplitz Yule-Walker system directly. */
function bruteForcePacf(series: number[], k: number): number {
    const mean = series.reduce((sum, value) => sum + value, 0) / series.length;
    const centered = series.map((value) => value - mean);
    const c0 = centered.reduce((sum, value) => sum + value * value, 0);
    const r = (lag: number): number => {
        if (lag === 0) return 1;
        let sum = 0;
        for (let t = lag; t < series.length; t += 1) sum += centered[t] * centered[t - lag];
        return sum / c0;
    };
    const xtx = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => r(Math.abs(i - j))));
    const xty = Array.from({ length: k }, (_, i) => r(i + 1));
    return solve(xtx, xty)[k - 1];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(Number(frame.meta["maxLag"]) + 1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Partial Autocorrelation", () => {
    it("matches direct least-squares regression at each lag", () => {
        const series = [2.1, 2.6, 2.2, 1.8, 2.4, 3.1, 2.9, 2.5, 3.3, 3.8, 3.4, 3.0, 3.6, 4.2, 4.0, 3.5, 4.1, 4.7, 4.3, 3.9, 4.6, 5.1, 4.7, 4.2, 4.9, 5.5, 5.2, 4.8, 5.4, 6.0];
        const frames = [...mod.run({ series, maxLag: 4 })];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        const pacf = final?.meta["pacf"] as number[];
        const acf = final?.meta["acf"] as number[];
        expect(pacf[0]).toBe(1);
        expect(pacf[1]).toBeCloseTo(acf[1] as number, 12);
        for (let k = 1; k <= 4; k += 1) {
            expect(pacf[k] as number).toBeCloseTo(bruteForcePacf(series, k), 5);
        }
    });

    it("recovers AR(1) structure with near-zero later lags", () => {
        let state = 12345;
        let previous = 0;
        const series: number[] = [];
        for (let i = 0; i < 200; i += 1) {
            state = (Math.imul(1664525, state) + 1013904223) >>> 0;
            const noise = (state / 4294967296 - 0.5) * 2;
            previous = 0.6 * previous + noise;
            series.push(previous);
        }
        const frames = [...mod.run({ series, maxLag: 5 })];
        const pacf = frames[frames.length - 1]?.meta["pacf"] as number[];
        expect(pacf[1] as number).toBeGreaterThan(0.45);
        expect(pacf[1] as number).toBeLessThan(0.75);
        expect(Math.abs(pacf[2] as number)).toBeLessThan(0.2);
        expect(Math.abs(pacf[3] as number)).toBeLessThan(0.25);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
