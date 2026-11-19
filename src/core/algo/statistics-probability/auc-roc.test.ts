/**
 * auc-roc.test.ts - Independent Mann-Whitney check, perfect and random
 * extremes, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./auc-roc";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** AUC as the pairwise probability that a positive outranks a negative. */
function reference(scores: number[], labels: number[]): number {
    let favorable = 0;
    let pairs = 0;
    for (let i = 0; i < scores.length; i += 1) {
        for (let j = 0; j < scores.length; j += 1) {
            if (labels[i] === 1 && labels[j] === 0) {
                favorable += scores[i] > scores[j] ? 1 : scores[i] === scores[j] ? 0.5 : 0;
                pairs += 1;
            }
        }
    }
    return pairs === 0 ? 0 : favorable / pairs;
}

describe("AucRoc", () => {
    it("matches an independent pairwise ordering computation", () => {
        const datasets: Array<{ scores: number[]; labels: number[] }> = [
            { scores: [0.9, 0.8, 0.7, 0.65, 0.5, 0.4, 0.3, 0.2], labels: [1, 1, 0, 1, 0, 1, 0, 0] },
            { scores: [0.1, 0.6, 0.2, 0.8, 0.4, 0.9], labels: [0, 1, 0, 1, 1, 0] },
            { scores: [0.5, 0.5, 0.5, 0.5, 0.7, 0.3], labels: [1, 0, 1, 0, 1, 0] },
            { scores: [0.3, 0.9, 0.4, 0.8, 0.1, 0.7, 0.2, 0.6], labels: [1, 1, 0, 0, 0, 1, 1, 0] },
        ];
        for (const { scores, labels } of datasets) {
            const frames = [...mod.run({ scores, labels })];
            checkFrames(frames, scores.length);
            const final = frames[frames.length - 1];
            expect(Number(final.meta["auc"])).toBeCloseTo(reference(scores, labels), 10);
            expect(Number(final.meta["auc"])).toBeGreaterThanOrEqual(0);
            expect(Number(final.meta["auc"])).toBeLessThanOrEqual(1);
        }
    });

    it("gives one for perfect separation and zero for inverted scores", () => {
        const good = { scores: [0.9, 0.8, 0.7, 0.6], labels: [1, 1, 0, 0] };
        const bad = { scores: [0.1, 0.2, 0.3, 0.4], labels: [1, 1, 0, 0] };
        expect(Number([...mod.run(good)].at(-1)?.meta["auc"])).toBeCloseTo(1, 10);
        expect(Number([...mod.run(bad)].at(-1)?.meta["auc"])).toBeCloseTo(0, 10);
    });

    it("gives one half when every score is tied", () => {
        const tied = { scores: [0.5, 0.5, 0.5, 0.5], labels: [1, 0, 1, 0] };
        expect(Number([...mod.run(tied)].at(-1)?.meta["auc"])).toBeCloseTo(0.5, 10);
    });

    it("records ROC points starting at the origin and ending at the corner", () => {
        const final = [...mod.run(mod.defaultInput)].at(-1);
        const roc = final?.meta["rocPoints"] as number[];
        expect(roc[0]).toBe(0);
        expect(roc[1]).toBe(0);
        expect(roc[roc.length - 2]).toBe(1);
        expect(roc[roc.length - 1]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(11);
        expect(generator.next().done).toBe(true);
    });
});
