/**
 * nuts-sampler.test.ts - Integrator properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { leapfrog, noUTurn } from "./nuts-sampler";
import type { VisualFrame } from "@/types";

const MEAN = 0;
const SIGMA_SQ = 1;

function hamiltonian(q: number, p: number): number {
    return -Math.log(Math.exp(-0.5 * (q - MEAN) ** 2 / SIGMA_SQ)) + 0.5 * p * p;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("No-U-Turn Sampler", () => {
    it("leapfrog is time reversible", () => {
        for (const [q, p] of [[0.3, 0.7], [-1.2, 0.1], [2.0, -0.9]]) {
            const forward = leapfrog(q, p, 0.3, MEAN, SIGMA_SQ);
            const back = leapfrog(forward.q, -forward.p, 0.3, MEAN, SIGMA_SQ);
            expect(back.q).toBeCloseTo(q, 12);
            expect(back.p).toBeCloseTo(-p, 12);
        }
    });

    it("leapfrog nearly conserves energy for a small step", () => {
        const start = hamiltonian(0.4, 0.2);
        const next = leapfrog(0.4, 0.2, 0.05, MEAN, SIGMA_SQ);
        expect(Math.abs(hamiltonian(next.q, next.p) - start)).toBeLessThan(1e-3);
    });

    it("U-turn criterion matches the direct formula", () => {
        expect(noUTurn(-1, 0.5, 1, 0.5)).toBe(true);
        expect(noUTurn(-1, -0.5, 1, -0.5)).toBe(false);
        expect(noUTurn(2, 0.5, 3, 0.5)).toBe(true);
        expect(noUTurn(2, -0.5, 3, 0.5)).toBe(false);
        expect(noUTurn(0, 0, 0, 0)).toBe(true);
    });

    it("produces finite samples consistent with the target scale", () => {
        const input = { mean: 0, sigma: 1, q0: 0.5, stepSize: 0.4, maxDepth: 5, iterations: 20, seed: 11 };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        const samples = final?.meta["samples"] as number[];
        expect(samples.length).toBe(20);
        expect(samples.every((s) => Number.isFinite(s))).toBe(true);
        expect(samples.every((s) => Math.abs(s) < 6)).toBe(true);
        expect(Number(final?.meta["totalEvents"])).toBeGreaterThan(0);
        expect(Number.isFinite(Number(final?.meta["sampleMean"]))).toBe(true);

        const narrow = [...mod.run({ ...input, sigma: 0.2, iterations: 15 })];
        const narrowSamples = narrow[narrow.length - 1]?.meta["samples"] as number[];
        expect(narrowSamples.every((s) => Math.abs(s) < 1)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
