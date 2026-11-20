/** jaccard-loss.test.ts - Soft IoU definition, identity case, and relation to Dice. */

import { describe, expect, it } from "vitest";
import mod, { jaccardFor } from "./jaccard-loss";
import { diceFor } from "./dice-loss";
import type { VisualFrame } from "@/types";

interface Input {
    prediction: number[];
    truth: number[];
}

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBe(rows + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Soft Jaccard Loss", () => {
    const input = mod.defaultInput as Input;

    it("matches a brute-force overlap-over-union computation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.prediction.length);
        const last = frames[frames.length - 1];
        let overlap = 0;
        let predSum = 0;
        let truthSum = 0;
        for (let i = 0; i < input.prediction.length; i += 1) {
            const p = input.prediction[i] ?? 0;
            const t = input.truth[i] ?? 0;
            overlap += p * t;
            predSum += p;
            truthSum += t;
        }
        const union = predSum + truthSum - overlap + 1e-6;
        const iou = (overlap + 1e-6) / union;
        expect(last?.meta["iou"]).toBeCloseTo(iou, 9);
        expect(last?.meta["loss"]).toBeCloseTo(1 - iou, 9);
    });

    it("is zero for identical binary masks and nonnegative", () => {
        const map = [1, 1, 0, 1, 0];
        expect(jaccardFor(map, map).loss).toBeCloseTo(0, 9);
        const partial = jaccardFor([1, 0, 1, 0], [1, 1, 0, 0]);
        expect(partial.loss).toBeGreaterThanOrEqual(0);
        expect(partial.iou).toBeLessThanOrEqual(1);
    });

    it("is at least as large as Dice loss on the same maps", () => {
        const predictions = [0.9, 0.8, 0.2, 0.1, 0.7, 0.05];
        const truth = [1, 1, 0, 0, 1, 0];
        expect(jaccardFor(predictions, truth).loss).toBeGreaterThanOrEqual(
            diceFor(predictions, truth).loss - 1e-12,
        );
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
