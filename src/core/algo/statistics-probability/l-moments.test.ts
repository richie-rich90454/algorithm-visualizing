/**
 * l-moments.test.ts - Independent mean and Gini-difference checks, location
 * and scale behavior, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./l-moments";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], values: number[]): void {
    expect(frames.length).toBe(7);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(values.length);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function final(values: number[]): VisualFrame["meta"] {
    return [...mod.run({ values })].at(-1)?.meta ?? {};
}

/** Half of Gini's mean difference, computed from all pairs. */
function halfGini(values: number[]): number {
    let sum = 0;
    let pairs = 0;
    for (let i = 0; i < values.length; i += 1) {
        for (let j = i + 1; j < values.length; j += 1) {
            sum += Math.abs(values[i] - values[j]);
            pairs += 1;
        }
    }
    return pairs === 0 ? 0 : sum / (2 * pairs);
}

describe("LMoments", () => {
    it("matches the mean and half of Gini's mean difference", () => {
        const datasets = [
            [3, 1, 7, 2, 9, 4, 6, 5],
            [1, 2, 3, 4, 5, 6, 7],
            [2, 2, 2, 8, 8],
            [-4, 0, 3, 10],
        ];
        for (const values of datasets) {
            const frames = [...mod.run({ values })];
            checkFrames(frames, values);
            const mean = values.reduce((s, v) => s + v, 0) / values.length;
            expect(Number(frames[frames.length - 1].meta["L1"])).toBeCloseTo(mean, 10);
            expect(Number(frames[frames.length - 1].meta["L2"])).toBeCloseTo(halfGini(values), 10);
        }
    });

    it("shifts only L1 under a location change", () => {
        const base = [1, 2, 4, 7, 9];
        const shifted = base.map((v) => v + 12);
        const a = final(base);
        const b = final(shifted);
        expect(Number(b["L1"]) - Number(a["L1"])).toBeCloseTo(12, 10);
        for (const key of ["L2", "L3", "L4", "tau3", "tau4"]) {
            expect(Number(b[key])).toBeCloseTo(Number(a[key]), 10);
        }
    });

    it("scales every L-moment under a change of units", () => {
        const base = [1, 2, 4, 7, 9];
        const scaled = base.map((v) => v * 4);
        const a = final(base);
        const b = final(scaled);
        for (const key of ["L1", "L2", "L3", "L4"]) {
            expect(Number(b[key])).toBeCloseTo(4 * Number(a[key]), 10);
        }
        expect(Number(b["tau3"])).toBeCloseTo(Number(a["tau3"]), 10);
        expect(Number(b["tau4"])).toBeCloseTo(Number(a["tau4"]), 10);
    });

    it("keeps L2 nonnegative and tau ratios in range", () => {
        const meta = final([2, 3, 3, 5, 8, 11]);
        expect(Number(meta["L2"])).toBeGreaterThanOrEqual(0);
        expect(Math.abs(Number(meta["tau3"]))).toBeLessThanOrEqual(1.001);
        expect(Math.abs(Number(meta["tau4"]))).toBeLessThanOrEqual(1.001);
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
