/**
 * exponential-mechanism-differential-privacy.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./exponential-mechanism-differential-privacy";
import type { VisualFrame } from "@/types";

function reference(utilities: number[], epsilon: number, sensitivity: number, draw: number) {
    const weights = utilities.map((u) => Math.exp((epsilon * u) / (2 * sensitivity)));
    const total = weights.reduce((s, w) => s + w, 0);
    const probabilities = weights.map((w) => w / total);
    let cumulative = 0;
    let selected = 0;
    for (let i = 0; i < probabilities.length; i += 1) {
        cumulative += probabilities[i];
        if (draw < cumulative) { selected = i; break; }
    }
    return { probabilities, selected };
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Exponential mechanism", () => {
    it("matches an unshifted reference for probabilities and selection", () => {
        const cases: Array<{ utilities: number[]; epsilon: number; sensitivity: number; draw: number }> = [
            { utilities: [1, 2, 3, 2], epsilon: 1, sensitivity: 1, draw: 0.55 },
            { utilities: [0, 0, 0], epsilon: 2, sensitivity: 1, draw: 0.1 },
            { utilities: [-5, 10, 3], epsilon: 0.5, sensitivity: 2, draw: 0.9 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)] as VisualFrame[];
            checkFrames(frames, input.utilities.length);
            const expected = reference(input.utilities, input.epsilon, input.sensitivity, input.draw);
            const finalMeta = frames[frames.length - 1]?.meta;
            const got = finalMeta?.["probabilities"] as number[];
            expect(got).toHaveLength(input.utilities.length);
            for (let i = 0; i < got.length; i += 1) {
                expect(got[i]).toBeCloseTo(expected.probabilities[i], 10);
            }
            expect(got.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 10);
            expect(Number(finalMeta?.["selected"])).toBe(expected.selected);
        }
    });

    it("gives higher-utility candidates higher probability and uniform weights at epsilon zero", () => {
        const skewed = [...mod.run({ utilities: [1, 2, 3], epsilon: 2, sensitivity: 1, draw: 0.5 })];
        const probs = skewed[skewed.length - 1]?.meta["probabilities"] as number[];
        expect(probs[2]).toBeGreaterThan(probs[1]);
        expect(probs[1]).toBeGreaterThan(probs[0]);
        const uniform = [...mod.run({ utilities: [1, 2, 3], epsilon: 0.0000001, sensitivity: 1, draw: 0.5 })];
        const uniformProbs = uniform[uniform.length - 1]?.meta["probabilities"] as number[];
        expect(uniformProbs[0]).toBeCloseTo(1 / 3, 5);
        expect(uniformProbs[2]).toBeCloseTo(1 / 3, 5);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
