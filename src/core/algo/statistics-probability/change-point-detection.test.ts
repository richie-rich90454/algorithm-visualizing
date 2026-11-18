/**
 * change-point-detection.test.ts - Brute-force split scoring, synthetic shift
 * recovery, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./change-point-detection";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["n"]).toBe(n);
    });
}

/** Direct two-segment explained variation with no prefix sums. */
function bruteForce(series: number[], minLen: number): { splits: number[]; scores: number[]; best: number } {
    const n = series.length;
    const grand = series.reduce((a, b) => a + b, 0) / n;
    const total = series.reduce((a, x) => a + (x - grand) ** 2, 0);
    const splits: number[] = [];
    const scores: number[] = [];
    let best = minLen;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let k = minLen; k <= n - minLen; k += 1) {
        const left = series.slice(0, k);
        const right = series.slice(k);
        const leftMean = left.reduce((a, b) => a + b, 0) / left.length;
        const rightMean = right.reduce((a, b) => a + b, 0) / right.length;
        const sse = left.reduce((a, x) => a + (x - leftMean) ** 2, 0)
            + right.reduce((a, x) => a + (x - rightMean) ** 2, 0);
        const score = total - sse;
        splits.push(k);
        scores.push(score);
        if (score > bestScore + 1e-12) {
            bestScore = score;
            best = k;
        }
    }
    return { splits, scores, best };
}

describe("ChangePointDetection", () => {
    it("matches a direct brute-force scan of every split", () => {
        const input = mod.defaultInput as { series: number[]; minLen: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.series.length);
        const meta = frames[frames.length - 1]!.meta;
        const expected = bruteForce(input.series, input.minLen);
        expect(meta["splits"]).toEqual(expected.splits);
        const scores = meta["scores"] as number[];
        expect(scores.length).toBe(expected.scores.length);
        for (let i = 0; i < scores.length; i += 1) {
            expect(scores[i]).toBeCloseTo(expected.scores[i]!, 9);
        }
        expect(meta["split"]).toBe(expected.best);
        expect(meta["bestScore"]).toBeCloseTo(Math.max(...expected.scores), 9);
    });

    it("recovers the true boundary on several synthetic step signals", () => {
        const cases: Array<{ low: number; high: number; change: number }> = [
            { low: 0, high: 10, change: 5 },
            { low: -3, high: 4, change: 3 },
            { low: 100, high: 90, change: 7 },
        ];
        for (const testCase of cases) {
            const series = Array.from({ length: 12 }, (_, i) => (i < testCase.change ? testCase.low : testCase.high));
            const frames = [...mod.run({ series, minLen: 2 })];
            checkFrames(frames, 12);
            expect(frames[frames.length - 1]!.meta["split"]).toBe(testCase.change);
        }
    });

    it("respects the minimum segment length and reports the top score", () => {
        const series = [1, 9, 2, 8, 3, 7, 4, 6];
        const frames = [...mod.run({ series, minLen: 3 })];
        checkFrames(frames, series.length);
        const meta = frames[frames.length - 1]!.meta;
        const split = meta["split"] as number;
        expect(split).toBeGreaterThanOrEqual(3);
        expect(split).toBeLessThanOrEqual(series.length - 3);
        expect(meta["bestScore"]).toBeCloseTo(Math.max(...(meta["scores"] as number[])), 9);
    });

    it("handles a series too short to split", () => {
        const frames = [...mod.run({ series: [1, 2, 3], minLen: 2 })];
        checkFrames(frames, 3);
        expect(frames[frames.length - 1]!.meta["split"]).toBe(-1);
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
