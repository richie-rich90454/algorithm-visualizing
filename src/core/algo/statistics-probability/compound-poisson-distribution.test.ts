/**
 * compound-poisson-distribution.test.ts - Brute-force convolution cross-check, moments, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./compound-poisson-distribution";
import type { VisualFrame } from "@/types";

/** Factorial of a small integer. */
function factorial(n: number): number {
    let result = 1;
    for (let i = 2; i <= n; i += 1) result *= i;
    return result;
}

/** Brute-force compound mass by summing Poisson-weighted n-fold convolutions. */
function bruteForce(lambda: number, claims: number[], maxS: number): number[] {
    const result = new Array<number>(maxS + 1).fill(0);
    let conv = new Array<number>(maxS + 1).fill(0);
    conv[0] = 1;
    let poissonWeight = Math.exp(-lambda);
    for (let n = 0; n <= 60; n += 1) {
        for (let s = 0; s <= maxS; s += 1) result[s] = result[s] as number + poissonWeight * (conv[s] as number);
        if (n === 60) break;
        const next = new Array<number>(maxS + 1).fill(0);
        for (let s = 0; s <= maxS; s += 1) {
            for (let j = 1; j <= claims.length; j += 1) {
                if (s - j >= 0) next[s] = next[s] as number + (claims[j - 1] as number) * (conv[s - j] as number);
            }
        }
        conv = next;
        poissonWeight *= lambda / (n + 1);
    }
    return result;
}

function checkFrames(frames: VisualFrame[], maxS: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(maxS + 1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Compound Poisson Distribution", () => {
    it("matches an explicit convolution of Poisson-weighted claim counts", () => {
        const lambda = 2.5;
        const claims = [0.5, 0.3, 0.2];
        const frames = [...mod.run({ lambda, claims, maxS: 20 })];
        checkFrames(frames, 20);
        const final = frames[frames.length - 1];
        const pmf = final?.meta["pmf"] as number[];
        const expected = bruteForce(lambda, claims, 20);
        pmf.forEach((value, s) => {
            expect(value).toBeCloseTo(expected[s] as number, 8);
        });
        expect(pmf[0] as number).toBeCloseTo(Math.exp(-lambda), 12);
    });

    it("reports exact aggregate moments and stays nonnegative", () => {
        const lambda = 3;
        const claims = [0.6, 0.4];
        const frames = [...mod.run({ lambda, claims, maxS: 24 })];
        const final = frames[frames.length - 1];
        const pmf = final?.meta["pmf"] as number[];
        const claimMean = 1 * 0.6 + 2 * 0.4;
        const claimSecond = 1 * 0.6 + 4 * 0.4;
        expect(final?.meta["mean"] as number).toBeCloseTo(lambda * claimMean, 10);
        expect(final?.meta["variance"] as number).toBeCloseTo(lambda * claimSecond, 10);
        expect(pmf.every((value) => value >= 0)).toBe(true);
        expect(bruteForce(lambda, claims, 24).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(1.0000001);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
