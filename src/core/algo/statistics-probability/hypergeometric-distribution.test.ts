/**
 * hypergeometric-distribution.test.ts - Brute-force subset count, moments, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, {
    binomial,
    hypergeometricPmf,
    hypergeometricSupport,
} from "./hypergeometric-distribution";
import type { VisualFrame } from "@/types";

/** Enumerate every n-subset and count those with exactly k marked items. */
function bruteForceCount(N: number, K: number, n: number, k: number): number {
    let count = 0;
    for (let mask = 0; mask < 1 << N; mask += 1) {
        let drawn = 0;
        let successes = 0;
        for (let i = 0; i < N; i += 1) {
            if ((mask & (1 << i)) === 0) continue;
            drawn += 1;
            if (i < K) successes += 1;
        }
        if (drawn === n && successes === k) count += 1;
    }
    return count;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Hypergeometric Distribution", () => {
    it("matches exhaustive subset enumeration", () => {
        const N = 10;
        const K = 4;
        const n = 5;
        const total = binomial(N, n);
        for (let k = 0; k <= n; k += 1) {
            const expected = bruteForceCount(N, K, n, k) / total;
            expect(hypergeometricPmf(N, K, n, k)).toBeCloseTo(expected, 12);
        }
    });

    it("has support bounds, unit mass, and correct moments", () => {
        for (const [N, K, n] of [[12, 5, 4], [8, 8, 3], [9, 0, 6], [7, 3, 7], [6, 2, 1]]) {
            const [low, high] = hypergeometricSupport(N, K, n);
            let sum = 0;
            let mean = 0;
            let secondMoment = 0;
            for (let k = 0; k <= n; k += 1) {
                const p = hypergeometricPmf(N, K, n, k);
                if (k < low || k > high) expect(p).toBe(0);
                expect(p).toBeGreaterThanOrEqual(0);
                expect(p).toBeLessThanOrEqual(1);
                sum += p;
                mean += k * p;
                secondMoment += k * k * p;
            }
            expect(sum).toBeCloseTo(1, 10);
            expect(mean).toBeCloseTo((n * K) / N, 10);
            const variance = N > 1 ? (n * (K / N) * (1 - K / N) * (N - n)) / (N - 1) : 0;
            expect(secondMoment - mean * mean).toBeCloseTo(variance, 10);
        }
    });

    it("computes exact binomial coefficients", () => {
        expect(binomial(5, 2)).toBe(10);
        expect(binomial(12, 4)).toBe(495);
        expect(binomial(6, 7)).toBe(0);
        expect(binomial(10, 0)).toBe(1);
    });

    it("produces well-formed frames with a normalized final distribution", () => {
        const input = mod.defaultInput as { N: number; K: number; n: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.n);
        const final = frames[frames.length - 1]!;
        expect(Number(final.meta["sum"])).toBeCloseTo(1, 10);
        expect(Number(final.meta["mean"])).toBeCloseTo((input.n * input.K) / input.N, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
