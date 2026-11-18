/**
 * conjugate-prior-update.test.ts - Parameter update, predictive property,
 * density sanity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./conjugate-prior-update";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], m: number, samples: number): void {
    expect(frames.length).toBe(m + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(samples);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("conjugate prior update", () => {
    it("adds one to alpha for success and one to beta for failure", () => {
        const observations = [1, 1, 0, 1, 0, 0, 1];
        const frames = [...mod.run({ alpha: 2, beta: 2, observations, samples: 21 })];
        checkFrames(frames, observations.length, 21);
        let successes = 0;
        let failures = 0;
        for (let i = 0; i < observations.length; i += 1) {
            if (observations[i] === 1) {
                successes += 1;
            } else {
                failures += 1;
            }
            const meta = frames[i + 1]?.meta;
            expect(Number(meta?.["posteriorAlpha"])).toBe(2 + successes);
            expect(Number(meta?.["posteriorBeta"])).toBe(2 + failures);
            expect(Number(meta?.["successes"])).toBe(successes);
            expect(Number(meta?.["failures"])).toBe(failures);
        }
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["posteriorAlpha"])).toBe(6);
        expect(Number(last?.["posteriorBeta"])).toBe(5);
    });

    it("makes the predictive probability equal the posterior mean", () => {
        const frames = [...mod.run({ alpha: 3, beta: 5, observations: [1, 0, 1, 1], samples: 21 })];
        checkFrames(frames, 4, 21);
        for (const frame of frames) {
            const meta = frame.meta;
            const alpha = Number(meta["posteriorAlpha"]);
            const beta = Number(meta["posteriorBeta"]);
            expect(Number(meta["posteriorMean"])).toBeCloseTo(alpha / (alpha + beta), 12);
            expect(Number(meta["predictive"])).toBeCloseTo(alpha / (alpha + beta), 12);
        }
    });

    it("keeps a symmetric posterior centered at one half with balanced data", () => {
        const frames = [...mod.run({ alpha: 2, beta: 2, observations: [1, 0, 1, 0], samples: 21 })];
        checkFrames(frames, 4, 21);
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["posteriorAlpha"])).toBe(4);
        expect(Number(last?.["posteriorBeta"])).toBe(4);
        expect(Number(last?.["posteriorMean"])).toBeCloseTo(0.5, 12);
        const density = last?.["posteriorPdf"] as number[];
        const grid = last?.["grid"] as number[];
        const peakIndex = density.indexOf(Math.max(...density));
        expect(grid[peakIndex]).toBeCloseTo(0.5, 1);
        for (const value of density) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(value)).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(9);
        expect(generator.next().done).toBe(true);
    });
});
