/**
 * matthews-correlation-coefficient.test.ts - Independent confusion-matrix
 * computation, known value, bounds, class-swap invariance, frame shape,
 * termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./matthews-correlation-coefficient";
import type { VisualFrame } from "@/types";

function reference(truth: number[], predicted: number[], positive: number): number {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (let i = 0; i < Math.min(truth.length, predicted.length); i += 1) {
        const t = (truth[i] ?? 0) === positive ? 1 : 0;
        const p = (predicted[i] ?? 0) === positive ? 1 : 0;
        if (t === 1 && p === 1) tp += 1;
        else if (t === 0 && p === 1) fp += 1;
        else if (t === 1 && p === 0) fn += 1;
        else tn += 1;
    }
    const denom = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
    return denom === 0 ? 0 : (tp * tn - fp * fn) / denom;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
    expect(frames.length).toBe(n + 2);
}

describe("MatthewsCorrelationCoefficient", () => {
    it("matches an independent confusion-matrix computation", () => {
        const truth = [1, 1, 1, 0, 0, 0, 2, 2, 1, 0];
        const pred = [1, 0, 1, 0, 1, 0, 2, 1, 1, 0];
        const frames = [...mod.run({ trueLabels: truth, predictedLabels: pred, positives: 1 })];
        checkFrames(frames, truth.length);
        expect(Number(frames[frames.length - 1].meta["mcc"])).toBeCloseTo(reference(truth, pred, 1), 10);
        expect((frames[frames.length - 1].meta["tp"] as number) + (frames[frames.length - 1].meta["fp"] as number) + (frames[frames.length - 1].meta["tn"] as number) + (frames[frames.length - 1].meta["fn"] as number)).toBe(truth.length);
    });

    it("reaches one for a perfect classifier and respects the bounds", () => {
        const mcc = (t: number[], p: number[]) => Number([...mod.run({ trueLabels: t, predictedLabels: p })].at(-1)?.meta["mcc"]);
        expect(mcc([1, 1, 0, 0], [1, 1, 0, 0])).toBeCloseTo(1, 10);
        expect(mcc([1, 1, 0, 0], [0, 0, 1, 1])).toBeCloseTo(-1, 10);
        expect(Math.abs(mcc([1, 0, 1], [1, 0, 0]))).toBeLessThanOrEqual(1);
    });

    it("is invariant under swapping the two class names", () => {
        const t = [1, 1, 0, 0, 1, 0];
        const p = [1, 0, 0, 0, 1, 1];
        const before = Number([...mod.run({ trueLabels: t, predictedLabels: p, positives: 1 })].at(-1)?.meta["mcc"]);
        const tSwap = t.map((v) => 1 - v);
        const pSwap = p.map((v) => 1 - v);
        const after = Number([...mod.run({ trueLabels: tSwap, predictedLabels: pSwap, positives: 0 })].at(-1)?.meta["mcc"]);
        expect(after).toBeCloseTo(before, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBe(12);
        expect(generator.next().done).toBe(true);
    });
});
