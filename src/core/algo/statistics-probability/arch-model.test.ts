/**
 * arch-model.test.ts - Recursion and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import mod, { archFilter } from "./arch-model";
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
    });
}

/** Independent direct evaluation of each ARCH variance with no shared state. */
function referenceVariance(returns: number[], mu: number, omega: number, alphas: number[], t: number): number {
    let v = omega;
    for (let lag = 1; lag <= alphas.length; lag += 1) {
        if (t - lag >= 0) {
            const shock = (returns[t - lag] ?? 0) - mu;
            v += alphas[lag - 1]! * shock * shock;
        }
    }
    return v;
}

describe("ARCH(q) model", () => {
    it("matches a from-scratch evaluation of every variance", () => {
        const returns = [0.01, -0.02, 0.015, -0.008, 0.02, -0.012, 0.006, -0.004];
        const alphas = [0.35, 0.25, 0.1];
        const result = archFilter(returns, 0, 0.0002, alphas);
        for (let t = 0; t < returns.length; t += 1) {
            expect(result.variances[t]).toBeCloseTo(referenceVariance(returns, 0, 0.0002, alphas, t), 12);
        }
        expect(result.persistence).toBeCloseTo(0.7, 12);
        expect(result.unconditionalVariance).toBeCloseTo(0.0002 / 0.3, 12);
    });

    it("computes the Gaussian log likelihood correctly", () => {
        const returns = [0.02, -0.01, 0.03, -0.02];
        const result = archFilter(returns, 0, 0.001, [0.4]);
        let expected = 0;
        for (let t = 0; t < returns.length; t += 1) {
            const shock = returns[t]!;
            const variance = result.variances[t]!;
            expected += -0.5 * (Math.log(2 * Math.PI * variance) + (shock * shock) / variance);
        }
        expect(result.logLikelihood).toBeCloseTo(expected, 10);
    });

    it("produces well-formed frames whose meta variance path agrees", () => {
        const input = mod.defaultInput as { returns: number[]; mu: number; omega: number; alphas: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.returns.length);
        const final = frames[frames.length - 1]?.meta as {
            variances: number[];
            logLikelihood: number;
            done: boolean;
        };
        expect(final.done).toBe(true);
        for (let t = 0; t < input.returns.length; t += 1) {
            expect(final.variances[t]).toBeCloseTo(
                referenceVariance(input.returns, input.mu, input.omega, input.alphas, t),
                12,
            );
        }
        expect(Number.isFinite(final.logLikelihood)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
