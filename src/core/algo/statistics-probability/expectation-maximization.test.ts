/**
 * expectation-maximization.test.ts - Independent EM reference, likelihood monotonicity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./expectation-maximization";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number, iterations: number): void {
    expect(frames.length).toBe(2 * iterations + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const r1 = frame.meta["responsibilities"] as number[];
        const r2 = frame.meta["resp2"] as number[];
        for (let i = 0; i < n; i += 1) {
            expect(r1[i]!).toBeGreaterThanOrEqual(0);
            expect(r1[i]!).toBeLessThanOrEqual(1);
            expect(r1[i]! + r2[i]!).toBeCloseTo(1, 10);
        }
    });
}

function normalDensity(x: number, mu: number, variance: number): number {
    return Math.exp(-((x - mu) ** 2) / (2 * variance)) / Math.sqrt(2 * Math.PI * variance);
}

/** Straightforward independent EM reference with fixed variance. */
function referenceEM(data: number[], iterations: number, initial: number[], variance: number): { means: number[]; weights: number[] } {
    let mu1 = initial[0]!;
    let mu2 = initial[1]!;
    let w1 = 0.5;
    for (let step = 0; step < iterations; step += 1) {
        const r1 = data.map((x) => {
            const a = w1 * normalDensity(x, mu1, variance);
            const b = (1 - w1) * normalDensity(x, mu2, variance);
            return a / (a + b);
        });
        const r2 = r1.map((r) => 1 - r);
        const n1 = r1.reduce((s, r) => s + r, 0);
        const n2 = r2.reduce((s, r) => s + r, 0);
        w1 = n1 / data.length;
        mu1 = r1.reduce((s, r, i) => s + r * data[i]!, 0) / n1;
        mu2 = r2.reduce((s, r, i) => s + r * data[i]!, 0) / n2;
    }
    return { means: [mu1, mu2], weights: [w1, 1 - w1] };
}

describe("Expectation-maximization (Gaussian mixture)", () => {
    it("matches an independent EM implementation", () => {
        const cases = [
            { data: [1.0, 1.2, 1.5, 0.9, 1.1, 5.0, 5.3, 4.8, 5.5, 5.1], iterations: 8, variance: 1, initialMeans: [2, 4] },
            { data: [-3, -2.5, -3.2, 2, 2.5, 3], iterations: 12, variance: 0.8, initialMeans: [-1, 1] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.data.length, testCase.iterations);
            const meta = frames[frames.length - 1]?.meta;
            const want = referenceEM(testCase.data, testCase.iterations, testCase.initialMeans, testCase.variance);
            const gotMeans = meta?.["means"] as number[];
            const gotWeights = meta?.["weights"] as number[];
            expect(gotMeans[0]).toBeCloseTo(want.means[0]!, 9);
            expect(gotMeans[1]).toBeCloseTo(want.means[1]!, 9);
            expect(gotWeights[0]).toBeCloseTo(want.weights[0]!, 9);
            expect(gotWeights[1]).toBeCloseTo(want.weights[1]!, 9);
        }
    });

    it("never decreases the log-likelihood across E-steps", () => {
        const frames = [...mod.run({ data: [0, 0.2, 0.4, 4, 4.2, 3.9], iterations: 10, variance: 1, initialMeans: [1, 3] })];
        checkFrames(frames, 6, 10);
        let previous = Number.NEGATIVE_INFINITY;
        for (let index = 1; index <= 19; index += 2) {
            const current = Number(frames[index]?.meta["logLikelihood"]);
            expect(current).toBeGreaterThanOrEqual(previous - 1e-9);
            previous = current;
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(18);
        expect(generator.next().done).toBe(true);
    });
});
