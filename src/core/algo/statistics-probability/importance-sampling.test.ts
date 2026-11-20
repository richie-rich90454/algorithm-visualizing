/**
 * importance-sampling.test.ts - Brute-force recomputation and convergence checks.
 */

import { describe, expect, it } from "vitest";
import mod, { importanceEstimate } from "./importance-sampling";
import type { VisualFrame } from "@/types";

const INV_SQRT_2PI = 0.3989422804014327;
const normalPdf = (x: number): number => INV_SQRT_2PI * Math.exp((-x * x) / 2);

/** Independent copy of mulberry32 used to recompute every draw by hand. */
function independentRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Straightforward independent recomputation of the estimator. */
function bruteForce(A: number, n: number, seed: number) {
    const random = independentRandom(seed);
    const q = 1 / (2 * A);
    let sum = 0;
    let weightSum = 0;
    let squareSum = 0;
    for (let i = 0; i < n; i += 1) {
        const x = -A + 2 * A * random();
        const w = normalPdf(x) / q;
        sum += x * x * w;
        weightSum += w;
        squareSum += w * w;
    }
    return {
        estimate: sum / n,
        selfNormalized: sum / weightSum,
        ess: (weightSum * weightSum) / squareSum,
    };
}

/** Trapezoidal integral of x^2 phi(x) over [-A, A]; should be near 1. */
function numericGroundTruth(A: number): number {
    const n = 200000;
    const h = (2 * A) / n;
    let sum = 0.5 * ((-A) ** 2 * normalPdf(-A) + A ** 2 * normalPdf(A));
    for (let i = 1; i < n; i += 1) {
        const x = -A + i * h;
        sum += x * x * normalPdf(x);
    }
    return sum * h;
}

function checkFrames(frames: VisualFrame[], batches: number): void {
    expect(frames.length).toBe(batches + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.entities.length).toBeLessThanOrEqual(batches);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Importance Sampling", () => {
    it("matches a brute-force recomputation of every draw", () => {
        const A = 4;
        const n = 5000;
        const seed = 777;
        const result = importanceEstimate(A, n, seed, 5);
        const expected = bruteForce(A, n, seed);
        expect(result.estimate).toBeCloseTo(expected.estimate, 10);
        expect(result.selfNormalized).toBeCloseTo(expected.selfNormalized, 10);
        expect(result.effectiveSampleSize).toBeCloseTo(expected.ess, 8);
        expect(result.weights.length).toBe(n);
        expect(result.weights.every((w) => w > 0 && Number.isFinite(w))).toBe(true);
    });

    it("converges to the numerically integrated exact expectation", () => {
        const A = 5;
        const truth = numericGroundTruth(A);
        expect(Math.abs(truth - 1)).toBeLessThan(1e-3);
        const result = importanceEstimate(A, 30000, 2024, 10);
        expect(Math.abs(result.estimate - truth)).toBeLessThan(0.06);
        expect(Math.abs(result.selfNormalized - truth)).toBeLessThan(0.06);
        expect(result.effectiveSampleSize).toBeGreaterThan(1);
        expect(result.effectiveSampleSize).toBeLessThan(30000);
    });

    it("is seeded and emits well-formed frame batches", () => {
        const input = mod.defaultInput as {
            samples: number;
            proposalHalfWidth: number;
            seed: number;
            batches: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.batches);
        const first = importanceEstimate(input.proposalHalfWidth, input.samples, input.seed, input.batches);
        const second = importanceEstimate(input.proposalHalfWidth, input.samples, input.seed, input.batches);
        expect(first.estimate).toBe(second.estimate);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["estimate"])).toBeCloseTo(first.estimate, 10);
        expect(Number(final?.["trueValue"])).toBe(1);
        expect(Number(final?.["absoluteError"])).toBeLessThan(0.15);
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
