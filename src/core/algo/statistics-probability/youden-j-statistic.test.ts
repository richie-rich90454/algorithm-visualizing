/** youden-j-statistic.test.ts - brute-force threshold sweep, perfect-separator property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./youden-j-statistic";
import type { VisualFrame } from "@/types";

function referenceJ(scores: number[], labels: number[], t: number): number {
    const n = Math.min(scores.length, labels.length);
    let tp = 0, fp = 0, pos = 0, neg = 0;
    for (let i = 0; i < n; i += 1) {
        if (labels[i] === 1) pos += 1;
        else neg += 1;
        if (scores[i]! >= t) {
            if (labels[i] === 1) tp += 1;
            else fp += 1;
        }
    }
    const sens = pos > 0 ? tp / pos : 0;
    const spec = neg > 0 ? (neg - fp) / neg : 0;
    return sens + spec - 1;
}

function checkFrames(frames: VisualFrame[], d: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(d);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Youden J Statistic", () => {
    it("matches a brute-force sweep over every threshold", () => {
        const cases = [
            { scores: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], labels: [0, 0, 0, 0, 1, 1, 1, 1] },
            { scores: [0.9, 0.1, 0.6, 0.4, 0.7, 0.2], labels: [1, 0, 1, 0, 1, 0] },
            { scores: [1, 2, 3, 4, 5, 6, 7], labels: [1, 1, 0, 1, 0, 0, 1] },
        ];
        for (const c of cases) {
            const frames = [...mod.run(c)];
            const thresholds = frames.at(-1)?.meta["thresholds"] as number[];
            checkFrames(frames, thresholds.length);
            const js = frames.at(-1)?.meta["js"] as number[];
            thresholds.forEach((t, i) => expect(js[i]).toBeCloseTo(referenceJ(c.scores, c.labels, t), 9));
            expect(Number(frames.at(-1)?.meta["bestJ"])).toBeCloseTo(Math.max(...js), 9);
        }
    });

    it("reaches one for perfectly separable scores and zero for an uninformative case", () => {
        const perfect = [...mod.run({ scores: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], labels: [0, 0, 0, 1, 1, 1] })].at(-1)?.meta;
        expect(Number(perfect?.["bestJ"])).toBeCloseTo(1, 9);
        const flat = [...mod.run({ scores: [0.5, 0.5, 0.5, 0.5], labels: [0, 1, 0, 1] })].at(-1)?.meta;
        expect(Number(flat?.["bestJ"])).toBeCloseTo(0, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
