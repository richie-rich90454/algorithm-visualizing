/** dice-loss.test.ts - Soft overlap definition, identity case, and frame checks. */

import { describe, expect, it } from "vitest";
import mod, { diceFor } from "./dice-loss";
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

describe("Soft Dice Loss", () => {
    const input = mod.defaultInput as Input;

    it("matches a brute-force summation of overlap and sums", () => {
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
        const dice = (2 * overlap + 1e-6) / (predSum + truthSum + 1e-6);
        expect(last?.meta["dice"]).toBeCloseTo(dice, 9);
        expect(last?.meta["loss"]).toBeCloseTo(1 - dice, 9);
    });

    it("is zero for identical binary masks and nonnegative", () => {
        const map = [1, 1, 0, 1, 0];
        expect(diceFor(map, map).loss).toBeCloseTo(0, 9);
        const partial = diceFor([1, 0, 1, 0], [1, 1, 0, 0]);
        expect(partial.loss).toBeGreaterThanOrEqual(0);
        expect(partial.dice).toBeLessThanOrEqual(1);
    });

    it("handles empty maps with the epsilon guard", () => {
        const empty = diceFor([], []);
        expect(Number.isFinite(empty.loss)).toBe(true);
        expect(empty.loss).toBeGreaterThanOrEqual(0);
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
