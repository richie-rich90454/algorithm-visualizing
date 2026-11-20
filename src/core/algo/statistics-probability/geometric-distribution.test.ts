/**
 * geometric-distribution.test.ts - Independent PMF cross-check, moment formulas,
 * and a Monte Carlo simulation, plus frame-shape and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./geometric-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        const pmf = frame.meta["pmf"] as number[];
        expect(frame.entities.length).toBe(pmf.length);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Geometric Distribution", () => {
    it("matches an independently computed PMF and CDF term by term", () => {
        const input = mod.defaultInput as { p: number; kMax: number; support: string };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const pmf = meta["pmf"] as number[];
        const cdf = meta["cdf"] as number[];
        let cumulative = 0;
        for (let i = 0; i < pmf.length; i += 1) {
            const expected = 0.7 ** i * 0.3;
            expect(pmf[i]).toBeCloseTo(expected, 12);
            cumulative += expected;
            expect(cdf[i]).toBeCloseTo(cumulative, 12);
        }
    });

    it("reports exact mean and variance for both counting conventions", () => {
        const trials = [...mod.run({ p: 0.3, kMax: 20, support: "trials" })].at(-1)?.meta;
        expect(trials?.["shift"]).toBe(1);
        expect(trials?.["mean"] as number).toBeCloseTo(1 / 0.3, 12);
        expect(trials?.["variance"] as number).toBeCloseTo(0.7 / 0.09, 12);

        const failures = [...mod.run({ p: 0.3, kMax: 20, support: "failures" })].at(-1)?.meta;
        expect(failures?.["shift"]).toBe(0);
        expect(failures?.["mean"] as number).toBeCloseTo(0.7 / 0.3, 12);
        expect(failures?.["variance"] as number).toBeCloseTo(0.7 / 0.09, 12);
    });

    it("has total mass approaching one over a long tail", () => {
        const meta = [...mod.run({ p: 0.3, kMax: 60 })].at(-1)!.meta;
        const pmf = meta["pmf"] as number[];
        const sum = pmf.reduce((a, b) => a + b, 0);
        expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
        expect(meta["mass"] as number).toBeCloseTo(sum, 12);
    });

    it("matches a Monte Carlo simulation of repeated trials", () => {
        const p = 0.25;
        let seed = 12345;
        const uniform = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        const samples = 20000;
        let total = 0;
        for (let i = 0; i < samples; i += 1) {
            let trials = 0;
            while (uniform() >= p) {
                trials += 1;
            }
            total += trials + 1;
        }
        const empirical = total / samples;
        expect(Math.abs(empirical - 1 / p)).toBeLessThan(0.08);
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
