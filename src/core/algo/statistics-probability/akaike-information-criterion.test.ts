/**
 * akaike-information-criterion.test.ts - Brute-force score check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./akaike-information-criterion";
import type { VisualFrame } from "@/types";

interface Model {
    name: string;
    k: number;
    logLikelihood: number;
}

function checkFrames(frames: VisualFrame[], models: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(models);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("AkaikeInformationCriterion", () => {
    it("matches a brute-force AIC scan on the default input", () => {
        const { models, sampleSize } = mod.defaultInput as { models: Model[]; sampleSize: number };
        const frames = [...mod.run({ models, sampleSize })];
        checkFrames(frames, models.length);
        const expected = models.map((m) => 2 * m.k - 2 * m.logLikelihood);
        let best = 0;
        for (let i = 1; i < expected.length; i += 1) {
            if (expected[i] < expected[best]) {
                best = i;
            }
        }
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["aics"]).toEqual(expected);
        expect(final?.["bestIndex"]).toBe(best);
        expect(Number(final?.["bestAic"])).toBe(expected[best]);
    });

    it("computes the finite-sample AICc correction correctly", () => {
        const models: Model[] = [
            { name: "a", k: 1, logLikelihood: -10 },
            { name: "b", k: 3, logLikelihood: -9 },
        ];
        const sampleSize = 30;
        const frames = [...mod.run({ models, sampleSize })];
        const expected = models.map((m) => {
            const aic = 2 * m.k - 2 * m.logLikelihood;
            return aic + (2 * m.k * (m.k + 1)) / (sampleSize - m.k - 1);
        });
        const final = frames[frames.length - 1]?.meta;
        const aiccs = final?.["aiccs"] as number[];
        expect(aiccs.length).toBe(models.length);
        for (let i = 0; i < expected.length; i += 1) {
            expect(aiccs[i]).toBeCloseTo(expected[i], 10);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
