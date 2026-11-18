/**
 * gaussian-mixture-em.test.ts - Independent likelihood replay, EM monotonicity, frame shape.
 */

import { describe, expect, it } from "vitest";
import mod from "./gaussian-mixture-em";
import type { VisualFrame } from "@/types";

interface Input {
    data: number[];
    iterations: number;
    initMeans: [number, number];
    initVariances: [number, number];
    initWeights: [number, number];
}

function density(x: number, mean: number, variance: number): number {
    const v = Math.max(1e-9, variance);
    return Math.exp(-0.5 * ((x - mean) * (x - mean)) / v) / Math.sqrt(2 * Math.PI * v);
}

/** Independent EM replay returning the log-likelihood after every iteration. */
function reference(input: Input): number[] {
    let means: [number, number] = [input.initMeans[0], input.initMeans[1]];
    let variances: [number, number] = [input.initVariances[0], input.initVariances[1]];
    let weights: [number, number] = [input.initWeights[0], input.initWeights[1]];
    const n = input.data.length;
    const likelihoods: number[] = [];
    for (let iteration = 0; iteration <= input.iterations; iteration += 1) {
        const resp: number[] = [];
        let ll = 0;
        for (const x of input.data) {
            const d0 = weights[0] * density(x, means[0], variances[0]);
            const d1 = weights[1] * density(x, means[1], variances[1]);
            const total = d0 + d1 || 1e-300;
            resp.push(d1 / total);
            ll += Math.log(total);
        }
        likelihoods.push(ll);
        if (iteration === input.iterations) {
            break;
        }
        let n0 = 0;
        let n1 = 0;
        let s0 = 0;
        let s1 = 0;
        for (let i = 0; i < input.data.length; i += 1) {
            const r1 = resp[i] ?? 0;
            const r0 = 1 - r1;
            n0 += r0;
            n1 += r1;
            s0 += r0 * input.data[i]!;
            s1 += r1 * input.data[i]!;
        }
        const m0 = n0 > 1e-12 ? s0 / n0 : means[0];
        const m1 = n1 > 1e-12 ? s1 / n1 : means[1];
        let v0 = 0;
        let v1 = 0;
        for (let i = 0; i < input.data.length; i += 1) {
            const r1 = resp[i] ?? 0;
            v0 += (1 - r1) * (input.data[i]! - m0) ** 2;
            v1 += r1 * (input.data[i]! - m1) ** 2;
        }
        means = [m0, m1];
        variances = [v0 / Math.max(n0, 1e-12), v1 / Math.max(n1, 1e-12)];
        weights = [n0 / n, n1 / n];
    }
    return likelihoods;
}

function checkFrames(frames: VisualFrame[], pointCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(pointCount);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["logLikelihood"]).toBeTypeOf("number");
        const resp = frame.meta["responsibilities"] as number[];
        expect(Array.isArray(resp)).toBe(true);
        expect(resp.length).toBe(pointCount);
        for (const r of resp) {
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(1);
        }
    });
}

describe("Gaussian Mixture EM", () => {
    it("matches an independent log-likelihood replay", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.data.length);
        const expected = reference(input);
        expect(frames.length).toBe(expected.length + 1);
        for (let i = 0; i < expected.length; i += 1) {
            expect(Number(frames[i]?.meta["logLikelihood"])).toBeCloseTo(expected[i] ?? 0, 8);
        }
    });

    it("never decreases the likelihood and separates two clusters", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.data.length);
        for (let i = 1; i < frames.length; i += 1) {
            expect(Number(frames[i]?.meta["logLikelihood"])).toBeGreaterThanOrEqual(
                Number(frames[i - 1]?.meta["logLikelihood"]) - 1e-8,
            );
        }
        const final = frames[frames.length - 1]?.meta;
        const means = final?.["means"] as number[];
        expect(Math.min(means[0] ?? 0, means[1] ?? 0)).toBeCloseTo(0.4, 0);
        expect(Math.max(means[0] ?? 0, means[1] ?? 0)).toBeCloseTo(9.9, 0);
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
