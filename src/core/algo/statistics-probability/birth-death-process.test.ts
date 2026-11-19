/**
 * birth-death-process.test.ts - Balance-equation and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import mod, { birthDeathStationary } from "./birth-death-process";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], states: number): void {
    expect(frames.length).toBe(states + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(states);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent stationary distribution by repeatedly applying the generator. */
function powerIteration(lambda: number[], mu: number[]): number[] {
    const N = lambda.length - 1;
    const size = N + 1;
    let pi = new Array<number>(size).fill(1 / size);
    const dt = 0.001;
    for (let iter = 0; iter < 200000; iter += 1) {
        const next = new Array<number>(size).fill(0);
        for (let i = 0; i < size; i += 1) {
            const out = (lambda[i] ?? 0) + (mu[i] ?? 0);
            next[i] = (next[i] ?? 0) + (pi[i] ?? 0) * (1 - dt * out);
            if (i > 0) {
                next[i - 1] = (next[i - 1] ?? 0) + dt * (pi[i] ?? 0) * (mu[i] ?? 0);
            }
            if (i < N) {
                next[i + 1] = (next[i + 1] ?? 0) + dt * (pi[i] ?? 0) * (lambda[i] ?? 0);
            }
        }
        pi = next;
    }
    return pi;
}

describe("Birth-death process", () => {
    it("matches independent power iteration", () => {
        const lambda = [0.8, 0.6, 0.4, 0];
        const mu = [0, 0.3, 0.5, 0.7];
        const result = birthDeathStationary(lambda, mu);
        const reference = powerIteration(lambda, mu);
        for (let i = 0; i < result.distribution.length; i += 1) {
            expect(result.distribution[i]).toBeCloseTo(reference[i]!, 5);
        }
        expect(Math.max(...result.balanceError)).toBeLessThan(1e-9);
    });

    it("reduces to a truncated geometric distribution for constant rates", () => {
        const N = 4;
        const lambda = new Array<number>(N + 1).fill(0.5);
        lambda[N] = 0;
        const mu = new Array<number>(N + 1).fill(0.25);
        mu[0] = 0;
        const result = birthDeathStationary(lambda, mu);
        const rho = 0.5 / 0.25;
        const normalization = Array.from({ length: N + 1 }, (_, i) => rho ** i).reduce((a, b) => a + b, 0);
        for (let i = 0; i <= N; i += 1) {
            expect(result.distribution[i]).toBeCloseTo(rho ** i / normalization, 10);
        }
        let mean = 0;
        for (let i = 0; i <= N; i += 1) {
            mean += i * (rho ** i / normalization);
        }
        expect(result.mean).toBeCloseTo(mean, 10);
    });

    it("produces well-formed frames", () => {
        const input = mod.defaultInput as { lambda: number[]; mu: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.lambda.length);
        const final = frames[frames.length - 1]?.meta as {
            distribution: number[];
            maxBalanceError: number;
            done: boolean;
        };
        expect(final.done).toBe(true);
        expect(final.distribution.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        expect(final.maxBalanceError).toBeLessThan(1e-9);
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
