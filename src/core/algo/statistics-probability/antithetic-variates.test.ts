/**
 * antithetic-variates.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./antithetic-variates";
import type { VisualFrame } from "@/types";

function payoff(u: number, fn: string, strike: number): number {
    if (fn === "exponential") return Math.exp(u);
    if (fn === "identity") return u;
    if (fn === "call") return Math.max(0, u - strike);
    return u * u;
}

function varOf(values: number[]): number {
    const m = values.reduce((s, x) => s + x, 0) / values.length;
    return values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Antithetic variates", () => {
    it("matches an independent reference and reduces variance for monotone payoffs", () => {
        const uniforms = [0.05, 0.15, 0.28, 0.42, 0.55, 0.68, 0.81, 0.93];
        const cases: Array<{ fn: string; strike: number; trueMean: number }> = [
            { fn: "identity", strike: 0.5, trueMean: 0.5 },
            { fn: "square", strike: 0.5, trueMean: 1 / 3 },
            { fn: "exponential", strike: 0.5, trueMean: Math.E - 1 },
            { fn: "call", strike: 0.5, trueMean: 0.125 },
        ];
        for (const { fn, strike, trueMean } of cases) {
            const frames = [...mod.run({ uniforms, fn, strike })] as VisualFrame[];
            checkFrames(frames, uniforms.length);
            const a = uniforms.map((u) => payoff(u, fn, strike));
            const pairs = uniforms.map((u) => 0.5 * (payoff(u, fn, strike) + payoff(1 - u, fn, strike)));
            const meanA = a.reduce((s, x) => s + x, 0) / a.length;
            const meanPairs = pairs.reduce((s, x) => s + x, 0) / pairs.length;
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(Number(finalMeta?.["naiveMean"])).toBeCloseTo(meanA, 10);
            expect(Number(finalMeta?.["antitheticMean"])).toBeCloseTo(meanPairs, 10);
            expect(Number(finalMeta?.["naiveVariance"])).toBeCloseTo(varOf(a), 10);
            expect(Number(finalMeta?.["antitheticVariance"])).toBeCloseTo(varOf(pairs), 10);
            expect(Number(finalMeta?.["reduced"])).toBe(1);
            // Both estimators are centered near the true expectation.
            expect(Math.abs(meanPairs - trueMean)).toBeLessThan(Math.abs(meanA - trueMean) + 0.2);
        }
    });

    it("gives an exactly constant paired estimator for the identity payoff", () => {
        const uniforms = [0.1, 0.2, 0.35, 0.6, 0.85];
        const frames = [...mod.run({ uniforms, fn: "identity" })];
        checkFrames(frames, uniforms.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["antitheticMean"])).toBeCloseTo(0.5, 10);
        expect(Number(finalMeta?.["antitheticVariance"])).toBeCloseTo(0, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
