/**
 * lattice-surgery.test.ts - Projective-measurement property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lattice-surgery";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const state = frame.meta["state"] as number[];
        expect(state.reduce((sum, a) => sum + a * a, 0)).toBeCloseTo(1, 10);
    });
}

function parity(index: number): number {
    return ((index >> 1) & 1) ^ (index & 1);
}

describe("LatticeSurgery", () => {
    it("projects onto the measured parity sector and is idempotent", () => {
        const states = [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1],
            [Math.SQRT1_2, 0, 0, Math.SQRT1_2],
            [0, 0.6, 0.8, 0],
            [0.5, 0.5, 0.5, 0.5],
        ];
        for (const amplitudes of states) {
            for (const requested of [0, 1]) {
                const frames = [...mod.run({ amplitudes, outcome: requested })];
                checkFrames(frames);
                const meta = frames[frames.length - 1]?.meta;
                const sector = meta?.["outcome"] as number;
                const outcomeProbability = meta?.["outcomeProbability"] as number;
                const projected = meta?.["state"] as number[];

                const expectedProbabilities = [0, 0];
                for (let i = 0; i < 4; i += 1) {
                    expectedProbabilities[parity(i)] = (expectedProbabilities[parity(i)] ?? 0) + (amplitudes[i] ?? 0) ** 2;
                }
                const reported = meta?.["parityProbabilities"] as number[];
                for (let i = 0; i < 2; i += 1) {
                    expect(reported[i]).toBeCloseTo(expectedProbabilities[i] ?? 0, 10);
                }

                const expectedProb = expectedProbabilities[sector] ?? 0;
                expect(outcomeProbability).toBeCloseTo(expectedProb, 10);
                for (let i = 0; i < 4; i += 1) {
                    const expected = parity(i) === sector && expectedProb > 1e-12
                        ? (amplitudes[i] ?? 0) / Math.sqrt(expectedProb)
                        : 0;
                    expect(projected[i]).toBeCloseTo(expected, 10);
                }
                expect(meta?.["repeatProbability"]).toBeCloseTo(1, 10);
                expect(meta?.["projectedNorm"]).toBeCloseTo(1, 10);
            }
        }
    });

    it("determines parity from the computational basis state", () => {
        for (const [index, expected] of [[0, 0], [1, 1], [2, 1], [3, 0]]) {
            const amplitudes = [0, 0, 0, 0];
            amplitudes[index as number] = 1;
            const meta = [...mod.run({ amplitudes })][4]?.meta;
            expect(meta?.["outcome"]).toBe(expected);
            expect(meta?.["outcomeProbability"]).toBeCloseTo(1, 12);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
