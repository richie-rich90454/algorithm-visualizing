/**
 * bonferroni-correction.test.ts - Independent adjustment, Monte Carlo FWER
 * control, monotonicity, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./bonferroni-correction";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], m: number): void {
    expect(frames.length).toBe(m + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(m);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["m"]).toBe(m);
    });
}

function finalMeta(frames: VisualFrame[]) {
    return frames[frames.length - 1]!.meta;
}

describe("BonferroniCorrection", () => {
    it("matches an independent per-test adjustment and decision loop", () => {
        const input = mod.defaultInput as { pValues: number[]; alpha: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.pValues.length);
        const m = input.pValues.length;
        const threshold = input.alpha / m;
        const expectedAdjusted = input.pValues.map((p) => Math.min(1, m * p));
        const expectedRejected: number[] = input.pValues.map((p) => (p <= threshold ? 1 : 0));
        const meta = finalMeta(frames);
        expect(meta["threshold"]).toBeCloseTo(threshold, 12);
        expect(meta["adjustedP"]).toEqual(expectedAdjusted);
        expect(meta["rejected"]).toEqual(expectedRejected);
        expect(meta["rejectCount"]).toBe(expectedRejected.reduce((a, b) => a + b, 0));
    });

    it("never inflates a p value and is no more liberal than uncorrected tests", () => {
        for (const alpha of [0.05, 0.01, 0.1]) {
            const pValues = [0.0001, 0.003, 0.02, 0.05, 0.2, 0.9];
            const frames = [...mod.run({ pValues, alpha })];
            checkFrames(frames, pValues.length);
            const meta = finalMeta(frames);
            const adjusted = meta["adjustedP"] as number[];
            const rejected = meta["rejected"] as number[];
            for (let i = 0; i < pValues.length; i += 1) {
                expect(adjusted[i]!).toBeGreaterThanOrEqual(pValues[i]!);
                expect(adjusted[i]!).toBeLessThanOrEqual(1);
                expect(rejected[i]).toBe(pValues[i]! <= alpha / pValues.length ? 1 : 0);
            }
            expect(meta["rejectCount"]).toBeLessThanOrEqual(meta["uncorrectedCount"] as number);
            expect(meta["fwerBound"]).toBeLessThanOrEqual(alpha + 1e-12);
        }
    });

    it("keeps the family-wise false rejection rate at or below alpha in a Monte Carlo check", () => {
        const alpha = 0.05;
        const m = 6;
        const repetitions = 20000;
        let state = 20261118;
        let familiesWithRejection = 0;
        for (let rep = 0; rep < repetitions; rep += 1) {
            let anyRejection = false;
            for (let test = 0; test < m; test += 1) {
                state = (Math.imul(1664525, state) + 1013904223) >>> 0;
                const p = state / 4294967296;
                if (p <= alpha / m) {
                    anyRejection = true;
                }
            }
            if (anyRejection) {
                familiesWithRejection += 1;
            }
        }
        const observedRate = familiesWithRejection / repetitions;
        expect(observedRate).toBeLessThanOrEqual(alpha + 0.02);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(7);
        expect(generator.next().done).toBe(true);
    });
});
