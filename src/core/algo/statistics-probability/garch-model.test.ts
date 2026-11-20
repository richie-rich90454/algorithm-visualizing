/**
 * garch-model.test.ts - Independent recursion and likelihood cross-checks.
 */

import { describe, expect, it } from "vitest";
import mod, { garchFilter } from "./garch-model";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2 * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(n);
    });
}

describe("GARCH(1,1) Model", () => {
    it("matches an independently written recursion and likelihood", () => {
        const returns = [0.02, -0.03, 0.01, 0.04, -0.015, 0.025, -0.005, 0.008, -0.02, 0.012];
        const mu = 0.002;
        const omega = 0.0002;
        const alpha = 0.12;
        const beta = 0.8;
        const result = garchFilter(returns, mu, omega, alpha, beta);

        let prevShock = 0;
        let prevVar = omega / (1 - alpha - beta);
        let likelihood = 0;
        for (let t = 0; t < returns.length; t += 1) {
            const shock = returns[t] - mu;
            const variance = omega + alpha * prevShock ** 2 + beta * prevVar;
            expect(result.shocks[t]).toBeCloseTo(shock, 12);
            expect(result.variances[t]).toBeCloseTo(variance, 12);
            likelihood += -0.5 * (Math.log(2 * Math.PI * variance) + (shock * shock) / variance);
            prevShock = shock;
            prevVar = variance;
        }
        expect(result.logLikelihood).toBeCloseTo(likelihood, 10);
        expect(result.persistence).toBeCloseTo(alpha + beta, 12);
        expect(result.unconditionalVariance).toBeCloseTo(omega / (1 - alpha - beta), 12);
    });

    it("keeps the fixed point and positivity properties", () => {
        const omega = 0.0001;
        const alpha = 0.05;
        const beta = 0.9;
        const uncond = omega / (1 - alpha - beta);
        const shocks = new Array(200)
            .fill(0)
            .map((_v, i) => (i % 2 === 0 ? Math.sqrt(uncond) : -Math.sqrt(uncond)));
        const steady = garchFilter(shocks, 0, omega, alpha, beta);
        expect(steady.unconditionalVariance).toBeCloseTo(uncond, 12);
        expect(steady.variances[199]).toBeCloseTo(uncond, 8);
        for (let t = 1; t < steady.variances.length; t += 1) {
            expect(steady.variances[t]).toBeGreaterThan(steady.variances[t - 1] ?? 0);
            expect(steady.variances[t]).toBeLessThanOrEqual(uncond + 1e-12);
        }
        const flat = garchFilter(new Array(30).fill(0), 0, omega, alpha, beta);
        for (const v of flat.variances) {
            expect(v).toBeGreaterThan(0);
        }
        const volatile = garchFilter([0.05, -0.05, 0.05], 0, omega, alpha, beta);
        const calm = garchFilter([0, 0, 0], 0, omega, alpha, beta);
        expect(volatile.variances[1]).toBeGreaterThan(calm.variances[1] ?? 0);
        expect(volatile.persistence).toBeLessThan(1);
    });

    it("emits step-by-step variance frames matching the final filter", () => {
        const input = mod.defaultInput as {
            returns: number[];
            mu: number;
            omega: number;
            alpha: number;
            beta: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.returns.length);
        const expected = garchFilter(
            input.returns,
            input.mu,
            input.omega,
            input.alpha,
            input.beta,
        );
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["persistence"])).toBeCloseTo(expected.persistence, 12);
        expect(Number(final?.["unconditionalVariance"])).toBeCloseTo(
            expected.unconditionalVariance,
            12,
        );
        expect(Number(final?.["logLikelihood"])).toBeCloseTo(expected.logLikelihood, 10);
        expect(final?.["variances"]).toEqual(expected.variances);
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
