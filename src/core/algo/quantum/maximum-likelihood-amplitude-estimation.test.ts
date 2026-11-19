/**
 * maximum-likelihood-amplitude-estimation.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./maximum-likelihood-amplitude-estimation";
import type { VisualFrame } from "@/types";

function predicted(a: number, factor: number): number {
    const value = Math.sin(factor * Math.asin(Math.sqrt(Math.max(0, Math.min(1, a)))));
    return value * value;
}

/** Independent brute-force grid optimizer on the principal branch. */
function bruteForce(zeros: number, ones: number, m: number): number {
    const factor = 2 * m + 1;
    const upper = Math.pow(Math.sin(Math.PI / (2 * factor)), 2);
    let bestA = 0;
    let bestL = -Infinity;
    for (let i = 0; i <= 20000; i += 1) {
        const a = (upper * i) / 20000;
        const p = Math.max(1e-12, Math.min(1 - 1e-12, predicted(a, factor)));
        const l = zeros * Math.log(p) + ones * Math.log(1 - p);
        if (l > bestL) {
            bestL = l;
            bestA = a;
        }
    }
    return bestA;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Maximum Likelihood Amplitude Estimation", () => {
    it("reduces to the observed fraction when there is no amplification", () => {
        const frames = [...mod.run({ zeros: 70, ones: 30, iterations: 0 })];
        checkFrames(frames);
        const estimate = Number(frames[frames.length - 1]?.meta["estimate"]);
        expect(estimate).toBeCloseTo(0.7, 6);
    });

    it("matches an independent brute-force optimizer", () => {
        const cases = [
            { zeros: 90, ones: 10, iterations: 2 },
            { zeros: 40, ones: 60, iterations: 1 },
            { zeros: 15, ones: 85, iterations: 3 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const estimate = Number(frames[frames.length - 1]?.meta["estimate"]);
            expect(Math.abs(estimate - bruteForce(input.zeros, input.ones, input.iterations))).toBeLessThan(1e-4);
        }
    });

    it("recovers a known amplitude from deterministic synthetic counts", () => {
        const trueA = 0.06;
        const m = 2;
        const p = predicted(trueA, 2 * m + 1);
        const shots = 4000;
        const frames = [...mod.run({ zeros: Math.round(shots * p), ones: shots - Math.round(shots * p), iterations: m })];
        const estimate = Number(frames[frames.length - 1]?.meta["estimate"]);
        expect(Math.abs(estimate - trueA)).toBeLessThan(1e-4);
    });

    it("guards against empty measurement counts", () => {
        const frames = [...mod.run({ zeros: 0, ones: 0, iterations: 2 })];
        expect(frames).toHaveLength(1);
        expect(frames[0]?.meta["converged"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
