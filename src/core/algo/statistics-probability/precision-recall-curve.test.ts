/**
 * precision-recall-curve.test.ts - Independent sweep reference, curve
 * properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./precision-recall-curve";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
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

/** Straightforward reference sweep independent of the module's sort and loop. */
function reference(scores: number[], labels: number[]) {
    const n = Math.min(scores.length, labels.length);
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || a - b);
    const positives = order.filter((i) => (labels[i] ?? 0) >= 0.5).length;
    const recalls: number[] = [];
    const precisions: number[] = [];
    let tp = 0;
    let previousRecall = 0;
    let ap = 0;
    for (let k = 0; k < n; k += 1) {
        const i = order[k]!;
        if ((labels[i] ?? 0) >= 0.5) tp += 1;
        const precision = tp / (k + 1);
        const recall = positives === 0 ? 1 : tp / positives;
        if ((labels[i] ?? 0) >= 0.5) ap += precision * (recall - previousRecall);
        previousRecall = recall;
        precisions.push(precision);
        recalls.push(recall);
    }
    return { positives, recalls, precisions, ap };
}

describe("PrecisionRecallCurve", () => {
    it("matches an independent sweep on the default input", () => {
        const input = mod.defaultInput as { scores: number[]; labels: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, Math.min(input.scores.length, input.labels.length));
        const expected = reference(input.scores, input.labels);
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["positives"]).toBe(expected.positives);
        expect(meta["recalls"] as number[]).toEqual(expected.recalls);
        expect(meta["precisions"] as number[]).toEqual(expected.precisions);
        expect(Number(meta["ap"])).toBeCloseTo(expected.ap, 12);
    });

    it("keeps recall monotone and gives average precision one for a perfect ranking", () => {
        for (const input of [
            { scores: [0.9, 0.8, 0.7, 0.6, 0.5, 0.4], labels: [1, 1, 1, 0, 0, 0] },
            { scores: [0.1, 0.5, 0.9, 0.3, 0.7, 0.2], labels: [0, 1, 1, 0, 1, 0] },
        ]) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.scores.length);
            const meta = frames[frames.length - 1]!.meta;
            const recalls = meta["recalls"] as number[];
            const precisions = meta["precisions"] as number[];
            for (let k = 1; k < recalls.length; k += 1) {
                expect(recalls[k]!).toBeGreaterThanOrEqual(recalls[k - 1]!);
            }
            expect(recalls.at(-1)).toBeCloseTo(1, 12);
            for (const precision of precisions) {
                expect(precision).toBeGreaterThanOrEqual(0);
                expect(precision).toBeLessThanOrEqual(1);
            }
            const ap = Number(meta["ap"]);
            expect(ap).toBeGreaterThanOrEqual(0);
            expect(ap).toBeLessThanOrEqual(1);
            if (input.labels.slice(0, 3).every((v) => v === 1)) {
                expect(ap).toBeCloseTo(1, 12);
            }
        }
    });

    it("handles an input with no positives", () => {
        const frames = [...mod.run({ scores: [0.3, 0.2, 0.1], labels: [0, 0, 0] })];
        checkFrames(frames, 3);
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["positives"]).toBe(0);
        expect(Number(meta["ap"])).toBe(0);
        expect(meta["recalls"] as number[]).toEqual([1, 1, 1]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
