/**
 * f1-score.test.ts - Brute-force confusion counts, F1 identity, edge cases,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./f1-score";
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

describe("F1Score", () => {
    it("matches brute-force confusion counts and the F1 formula", () => {
        const input = mod.defaultInput as { predictions: number[]; actual: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.predictions.length);
        let tp = 0;
        let fp = 0;
        let fn = 0;
        let tn = 0;
        for (let i = 0; i < input.predictions.length; i += 1) {
            const decided = (input.predictions[i] ?? 0) >= 0.5 ? 1 : 0;
            const truth = (input.actual[i] ?? 0) >= 0.5 ? 1 : 0;
            if (decided === 1 && truth === 1) tp += 1;
            else if (decided === 1 && truth === 0) fp += 1;
            else if (decided === 0 && truth === 1) fn += 1;
            else tn += 1;
        }
        const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
        const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
        const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["tp"]).toBe(tp);
        expect(meta["fp"]).toBe(fp);
        expect(meta["fn"]).toBe(fn);
        expect(meta["tn"]).toBe(tn);
        expect(Number(meta["precision"])).toBeCloseTo(precision, 12);
        expect(Number(meta["recall"])).toBeCloseTo(recall, 12);
        expect(Number(meta["f1"])).toBeCloseTo(f1, 12);
        expect(Number(meta["accuracy"])).toBeCloseTo((tp + tn) / input.predictions.length, 12);
    });

    it("gives F1 one for perfect predictions and zero when no positive is found", () => {
        const perfect = [...mod.run({ predictions: [0.9, 0.8, 0.2, 0.1], actual: [1, 1, 0, 0] })].at(-1)!.meta;
        expect(Number(perfect["f1"])).toBeCloseTo(1, 12);
        const none = [...mod.run({ predictions: [0.1, 0.2, 0.3], actual: [1, 1, 0] })].at(-1)!.meta;
        expect(Number(none["f1"])).toBe(0);
        expect(Number(none["recall"])).toBe(0);
    });

    it("keeps every rate in the unit interval", () => {
        const predictions = [0.6, 0.4, 0.55, 0.45, 0.9, 0.1];
        const actual = [1, 0, 0, 1, 1, 0];
        const frames = [...mod.run({ predictions, actual })];
        checkFrames(frames, predictions.length);
        const meta = frames[frames.length - 1]!.meta;
        for (const key of ["precision", "recall", "f1", "accuracy"]) {
            const value = Number(meta[key]);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
        }
        expect((meta["tp"] as number) + (meta["fp"] as number) + (meta["fn"] as number) + (meta["tn"] as number)).toBe(predictions.length);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
