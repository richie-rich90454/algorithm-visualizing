/** huber-loss.test.ts - Piecewise definition, continuity, evenness, and frame checks. */

import { describe, expect, it } from "vitest";
import mod, { huberFor } from "./huber-loss";
import type { VisualFrame } from "@/types";

interface Input {
    predictions: number[];
    targets: number[];
    delta: number;
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

describe("Huber Loss", () => {
    const input = mod.defaultInput as Input;

    it("matches a brute-force piecewise evaluation", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.predictions.length);
        const got = frames[frames.length - 1]?.meta["losses"] as number[];
        input.predictions.forEach((prediction, i) => {
            const r = prediction - (input.targets[i] ?? 0);
            const magnitude = Math.abs(r);
            const expected = magnitude <= input.delta
                ? 0.5 * r * r
                : input.delta * (magnitude - 0.5 * input.delta);
            expect(got[i]).toBeCloseTo(expected, 12);
        });
    });

    it("is continuous at the threshold and even in the residual", () => {
        const inside = huberFor(1, 1).loss;
        const outside = huberFor(1 + 1e-9, 1).loss;
        expect(inside).toBeCloseTo(outside, 6);
        for (const r of [-3, -1, -0.2, 0, 0.2, 1, 3]) {
            expect(huberFor(r, 1).loss).toBeCloseTo(huberFor(-r, 1).loss, 12);
            expect(huberFor(r, 1).loss).toBeGreaterThanOrEqual(0);
        }
    });

    it("reduces to squared error as the threshold grows", () => {
        const residual = 2;
        expect(huberFor(residual, 1e6).loss).toBeCloseTo(0.5 * residual * residual, 9);
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
