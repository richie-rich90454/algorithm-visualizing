/**
 * lomb-scargle-periodogram.test.ts - Least-squares cross-check, peak recovery, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lomb-scargle-periodogram";
import type { VisualFrame } from "@/types";

/** Solve a small dense system by Gauss-Jordan elimination. */
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

/** Independent R-squared from directly fitting a constant, cosine, and sine. */
function leastSquaresRSquared(times: number[], values: number[], frequency: number): number {
    const omega = 2 * Math.PI * frequency;
    const features = times.map((time) => [1, Math.cos(omega * time), Math.sin(omega * time)]);
    const xtx = Array.from({ length: 3 }, () => new Array<number>(3).fill(0));
    const xty = new Array<number>(3).fill(0);
    for (let i = 0; i < times.length; i += 1) {
        for (let a = 0; a < 3; a += 1) {
            xty[a] += features[i][a] * values[i];
            for (let b = 0; b < 3; b += 1) xtx[a][b] += features[i][a] * features[i][b];
        }
    }
    const coefficients = solve(xtx, xty);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    let sse = 0;
    let sst = 0;
    for (let i = 0; i < times.length; i += 1) {
        const fit = coefficients[0] + coefficients[1] * features[i][1] + coefficients[2] * features[i][2];
        sse += (values[i] - fit) ** 2;
        sst += (values[i] - mean) ** 2;
    }
    return 1 - sse / sst;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(Number(frame.meta["frequencyCount"]));
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Lomb-Scargle Periodogram", () => {
    const times = Array.from({ length: 60 }, (_, i) => (20 * (i + 0.3 * Math.sin(i * 1.7))) / 60);
    const values = times.map((time) => Math.sin(2 * Math.PI * 0.3 * time) + 0.2 * Math.cos(2 * Math.PI * 0.07 * time));

    it("recovers the frequency of an unevenly sampled sine wave", () => {
        const frames = [...mod.run({ times, values, frequencyCount: 400, fMax: 0.8 })];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["peakFrequency"] as number).toBeCloseTo(0.3, 2);
        expect(final?.meta["power"] as number[]).toHaveLength(400);
        (final?.meta["power"] as number[]).forEach((value) => {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(value)).toBe(true);
        });
    });

    it("places the peak where a direct least-squares scan does", () => {
        const frames = [...mod.run({ times, values, frequencyCount: 400, fMax: 0.8 })];
        const peak = frames[frames.length - 1]?.meta["peakFrequency"] as number;
        let bestFrequency = 0;
        let bestR = -Infinity;
        for (let f = 0.05; f <= 0.8; f += 0.01) {
            const rSquared = leastSquaresRSquared(times, values, f);
            if (rSquared > bestR) {
                bestR = rSquared;
                bestFrequency = f;
            }
        }
        expect(Math.abs(peak - bestFrequency)).toBeLessThan(0.02);
        expect(bestR).toBeGreaterThan(0.8);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
