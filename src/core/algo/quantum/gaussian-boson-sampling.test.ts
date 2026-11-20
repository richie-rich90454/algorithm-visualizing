/**
 * gaussian-boson-sampling.test.ts - Covariance check, analytic click-rate property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./gaussian-boson-sampling";
import type { VisualFrame } from "@/types";

interface Input {
    samples: number;
    squeeze0: number;
    squeeze1: number;
    angle: number;
    threshold: number;
    seed: number;
}

function erf(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const poly = ((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592;
    return sign * (1 - poly * t * Math.exp(-ax * ax));
}

function referenceCov(input: Input): number[] {
    const c = Math.cos(input.angle);
    const s = Math.sin(input.angle);
    const a = input.squeeze0 * input.squeeze0;
    const b = input.squeeze1 * input.squeeze1;
    return [c * c * a + s * s * b, c * s * (b - a), c * s * (b - a), s * s * a + c * c * b];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const counts = frame.meta["counts"] as number[];
        expect(counts.length).toBe(4);
        expect(counts.reduce((sum, v) => sum + v, 0)).toBe(frame.meta["drawn"]);
    });
}

describe("GaussianBosonSampling", () => {
    it("builds the covariance U diag(s^2) U transpose exactly", () => {
        const inputs: Input[] = [
            { samples: 100, squeeze0: 1, squeeze1: 2, angle: Math.PI / 4, threshold: 0.5, seed: 1 },
            { samples: 100, squeeze0: 2.5, squeeze1: 0.7, angle: 0.9, threshold: 0.3, seed: 2 },
        ];
        for (const input of inputs) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const cov = frames[0]!.meta["covariance"] as number[];
            const expected = referenceCov(input);
            for (let i = 0; i < 4; i += 1) {
                expect(cov[i]).toBeCloseTo(expected[i]!, 12);
            }
        }
    });

    it("matches analytic marginal click rates in the large-sample limit", () => {
        const input: Input = { samples: 30000, squeeze0: 1, squeeze1: 2, angle: Math.PI / 4, threshold: 0.5, seed: 11 };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]!.meta;
        const counts = final["counts"] as number[];
        const n = input.samples;
        const marginal0 = ((counts[2] ?? 0) + (counts[3] ?? 0)) / n;
        const marginal1 = ((counts[1] ?? 0) + (counts[3] ?? 0)) / n;
        const sigma = Math.sqrt(2.5);
        const analytic = 1 - erf(input.threshold / (sigma * Math.SQRT2));
        expect(marginal0).toBeCloseTo(analytic, 2);
        expect(marginal1).toBeCloseTo(analytic, 2);
        expect(final["analytic"] as number[]).toEqual([analytic, analytic]);
    });

    it("is deterministic for a fixed seed and sums counts to the sample budget", () => {
        const input: Input = { samples: 5000, squeeze0: 1.2, squeeze1: 2.1, angle: 0.7, threshold: 0.4, seed: 99 };
        const a = [...mod.run(input)].pop()?.meta["counts"];
        const b = [...mod.run(input)].pop()?.meta["counts"];
        expect(a).toEqual(b);
        expect((a as number[]).reduce((s, v) => s + v, 0)).toBe(input.samples);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
