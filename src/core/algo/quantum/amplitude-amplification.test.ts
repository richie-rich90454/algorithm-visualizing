/**
 * amplitude-amplification.test.ts - Closed-form rotation check, normalization, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./amplitude-amplification";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], states: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(states);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const probabilities = frame.meta["probabilities"] as number[];
        expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
        expect(probabilities.every((value) => value >= -1e-12 && value <= 1 + 1e-12)).toBe(true);
    });
}

describe("AmplitudeAmplification", () => {
    it("matches the exact two-subspace rotation for several sizes", () => {
        const cases: Array<{ states: number; marked: number[]; iterations: number }> = [
            { states: 4, marked: [1], iterations: 2 },
            { states: 8, marked: [1], iterations: 3 },
            { states: 8, marked: [2, 5], iterations: 2 },
            { states: 16, marked: [3], iterations: 3 },
        ];
        for (const { states, marked, iterations } of cases) {
            const frames = [...mod.run({ states, marked, iterations })];
            checkFrames(frames, states);
            const m = marked.length;
            const theta = Math.asin(Math.sqrt(m / states));
            for (let k = 0; k <= iterations; k += 1) {
                const target =
                    k === 0
                        ? frames[0]
                        : frames.find(
                              (frame) => frame.meta["phase"] === "diffusion" && frame.meta["iteration"] === k,
                          );
                expect(target).toBeDefined();
                const amplitudes = target?.meta["amplitudes"] as number[];
                const goodAmplitude = Math.sin((2 * k + 1) * theta) / Math.sqrt(m);
                const badAmplitude = Math.cos((2 * k + 1) * theta) / Math.sqrt(states - m);
                for (let i = 0; i < states; i += 1) {
                    const expected = marked.includes(i) ? goodAmplitude : badAmplitude;
                    expect(Math.abs(amplitudes[i] ?? 0)).toBeCloseTo(Math.abs(expected), 10);
                }
                expect(target?.meta["successProbability"] as number).toBeCloseTo(
                    Math.sin((2 * k + 1) * theta) ** 2,
                    10,
                );
            }
        }
    });

    it("reaches certainty for four states with one marked after one iteration", () => {
        const frames = [...mod.run({ states: 4, marked: [1], iterations: 1 })];
        const final = frames[frames.length - 1];
        expect(final?.meta["successProbability"]).toBeCloseTo(1, 10);
        expect((final?.meta["probabilities"] as number[])[1]).toBeCloseTo(1, 10);
        expect(final?.meta["optimalIterations"]).toBe(1);
        expect(frames[1]?.meta["phase"]).toBe("oracle");
        expect(frames[2]?.meta["phase"]).toBe("diffusion");
    });

    it("the oracle flip alone preserves measurement probabilities", () => {
        const frames = [...mod.run({ states: 8, marked: [3], iterations: 2 })];
        const initial = frames[0]?.meta["probabilities"] as number[];
        const afterOracle = frames[1]?.meta["probabilities"] as number[];
        initial.forEach((value, i) => expect(value).toBeCloseTo(afterOracle[i] ?? 0, 12));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
