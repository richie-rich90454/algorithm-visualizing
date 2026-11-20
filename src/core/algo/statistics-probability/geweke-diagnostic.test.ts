/**
 * geweke-diagnostic.test.ts - Independent z-score cross-check, symmetry, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./geweke-diagnostic";
import type { VisualFrame } from "@/types";

function reference(chain: number[], firstFraction = 0.1, lastFraction = 0.5) {
    const n = chain.length;
    const nA = Math.max(2, Math.min(n - 2, Math.floor(n * firstFraction)));
    const nB = Math.max(2, Math.min(n - nA, Math.floor(n * lastFraction)));
    const mean = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = (values: number[], mu: number): number => values.reduce((sum, value) => sum + (value - mu) * (value - mu), 0) / (values.length - 1);
    const first = chain.slice(0, nA);
    const last = chain.slice(n - nB);
    const meanA = mean(first);
    const meanB = mean(last);
    const varA = variance(first, meanA);
    const varB = variance(last, meanB);
    const z = (meanA - meanB) / Math.sqrt(varA / nA + varB / nB);
    return { nA, nB, meanA, meanB, varA, varB, z };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe((frame.meta["n"] as number));
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Geweke Diagnostic", () => {
    it("matches an independent z-score computation", () => {
        const chain = Array.from({ length: 120 }, (_, i) => Math.sin(i / 5) + (i % 7) / 10);
        const frames = [...mod.run({ chain })];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        const expected = reference(chain);
        expect(final?.meta["nA"]).toBe(expected.nA);
        expect(final?.meta["nB"]).toBe(expected.nB);
        expect(final?.meta["meanA"] as number).toBeCloseTo(expected.meanA, 12);
        expect(final?.meta["meanB"] as number).toBeCloseTo(expected.meanB, 12);
        expect(final?.meta["varA"] as number).toBeCloseTo(expected.varA, 12);
        expect(final?.meta["varB"] as number).toBeCloseTo(expected.varB, 12);
        expect(final?.meta["zScore"] as number).toBeCloseTo(expected.z, 12);
    });

    it("passes a constant chain and rejects a drifting chain", () => {
        const constant = [...mod.run({ chain: new Array<number>(100).fill(5) })];
        expect(constant[constant.length - 1]?.meta["zScore"]).toBe(0);
        expect(constant[constant.length - 1]?.meta["converged"]).toBe(true);

        const drifting = [...mod.run({ chain: Array.from({ length: 200 }, (_, i) => i) })];
        expect(Math.abs(drifting[drifting.length - 1]?.meta["zScore"] as number)).toBeGreaterThan(2);
        expect(drifting[drifting.length - 1]?.meta["converged"]).toBe(false);
    });

    it("flips the score sign when the chain is reversed", () => {
        const chain = Array.from({ length: 150 }, (_, i) => Math.cos(i / 4) + (i % 11) / 20);
        const forward = [...mod.run({ chain, firstFraction: 0.5, lastFraction: 0.5 })];
        const backward = [...mod.run({ chain: [...chain].reverse(), firstFraction: 0.5, lastFraction: 0.5 })];
        expect(backward[backward.length - 1]?.meta["zScore"] as number).toBeCloseTo(-(forward[forward.length - 1]?.meta["zScore"] as number), 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
