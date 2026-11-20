/**
 * boson-sampling.test.ts - Hong-Ou-Mandel, normalization, permanents, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { bosonDistribution, fourierUnitary, permanent, sampleOutcome } from "./boson-sampling";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Number.isFinite(frame.entities[0]?.value as number)).toBe(true);
    });
}

describe("Boson sampling (exact small simulation)", () => {
    it("permanent of a one-by-one matrix is its entry", () => {
        const value = permanent([[{ re: 3, im: 4 }]]);
        expect(value.re).toBeCloseTo(3, 12);
        expect(value.im).toBeCloseTo(4, 12);
    });

    it("permanent of a matrix of ones equals n factorial", () => {
        const ones = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => ({ re: 1, im: 0 })));
        expect(permanent(ones).re).toBeCloseTo(24, 10);
    });

    it("a two-by-two Fourier unitary has the Hong-Ou-Mandel dip", () => {
        const unitary = fourierUnitary(2);
        const outcomes = bosonDistribution(unitary, [0, 1], 2);
        const byLabel = new Map(outcomes.map((outcome) => [outcome.label, outcome.probability]));
        expect(byLabel.get("(2,0)")).toBeCloseTo(0.5, 10);
        expect(byLabel.get("(0,2)")).toBeCloseTo(0.5, 10);
        expect(byLabel.get("(1,1)")).toBeCloseTo(0, 10);
    });

    it("probabilities sum to one for several small instances", () => {
        const cases = [
            { modes: 3, photons: 2, input: [0, 1] },
            { modes: 4, photons: 2, input: [0, 2] },
            { modes: 4, photons: 3, input: [0, 1, 3] },
            { modes: 5, photons: 2, input: [1, 4] },
            { modes: 5, photons: 3, input: [0, 2, 4] },
        ];
        for (const testCase of cases) {
            const outcomes = bosonDistribution(fourierUnitary(testCase.modes), testCase.input, testCase.photons);
            const total = outcomes.reduce((sum, outcome) => sum + outcome.probability, 0);
            expect(total).toBeCloseTo(1, 8);
            expect(outcomes.every((outcome) => outcome.probability >= -1e-12)).toBe(true);
        }
    });

    it("sampling is deterministic and returns a valid index", () => {
        const outcomes = bosonDistribution(fourierUnitary(4), [0, 1], 2);
        const first = sampleOutcome(outcomes, 11);
        expect(sampleOutcome(outcomes, 11)).toBe(first);
        expect(first).toBeGreaterThanOrEqual(0);
        expect(first).toBeLessThan(outcomes.length);
    });

    it("reports a sampled outcome with normalized probabilities", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["probabilitySum"])).toBeCloseTo(1, 8);
        expect(String(final?.["sampled"])).toMatch(/^\(\d+,\d+,\d+,\d+\)$/);
        expect(Array.isArray(final?.["distribution"])).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
