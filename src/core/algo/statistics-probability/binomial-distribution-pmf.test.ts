/**
 * binomial-distribution-pmf.test.ts - Outcome enumeration, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./binomial-distribution-pmf";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Enumerate every sequence of n trials and accumulate probability by success count. */
function enumerateOutcomes(n: number, p: number): number[] {
    const totals = new Array<number>(n + 1).fill(0);
    const totalSequences = 2 ** n;
    for (let mask = 0; mask < totalSequences; mask += 1) {
        let successes = 0;
        let probability = 1;
        for (let i = 0; i < n; i += 1) {
            const success = ((mask >> i) & 1) === 1;
            probability *= success ? p : 1 - p;
            if (success) {
                successes += 1;
            }
        }
        totals[successes] = (totals[successes] ?? 0) + probability;
    }
    return totals;
}

describe("BinomialDistributionPmf", () => {
    it("matches enumeration of all trial outcomes", () => {
        for (const [n, p] of [
            [10, 0.5],
            [8, 0.3],
            [12, 0.7],
            [6, 0.1],
        ]) {
            const frames = [...mod.run({ n, p })];
            checkFrames(frames, n as number);
            const pmf = frames[frames.length - 1]?.meta["pmf"] as number[];
            const expected = enumerateOutcomes(n as number, p as number);
            for (let k = 0; k <= (n as number); k += 1) {
                expect(pmf[k]).toBeCloseTo(expected[k]!, 10);
            }
        }
    });

    it("sums to one and reports the mean and variance", () => {
        const frames = [...mod.run({ n: 10, p: 0.4 })];
        checkFrames(frames, 10);
        const meta = frames[frames.length - 1]?.meta;
        const pmf = meta?.["pmf"] as number[];
        expect(pmf.reduce((total, value) => total + value, 0)).toBeCloseTo(1, 10);
        expect(Number(meta?.["mean"])).toBeCloseTo(4, 12);
        expect(Number(meta?.["variance"])).toBeCloseTo(2.4, 12);
        const meanFromPmf = pmf.reduce((total, value, k) => total + k * value, 0);
        expect(meanFromPmf).toBeCloseTo(4, 10);
    });

    it("handles zero trials and certain success", () => {
        const empty = [...mod.run({ n: 0, p: 0.5 })];
        checkFrames(empty, 0);
        expect(empty[empty.length - 1]?.meta["pmf"]).toEqual([1]);

        const certain = [...mod.run({ n: 5, p: 1 })];
        checkFrames(certain, 5);
        expect(certain[certain.length - 1]?.meta["pmf"]).toEqual([0, 0, 0, 0, 0, 1]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(13);
        expect(generator.next().done).toBe(true);
    });
});
