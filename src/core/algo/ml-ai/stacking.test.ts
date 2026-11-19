/** stacking.test.ts - Reference weighted combination, one-hot weight property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./stacking";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface Input {
    predictions: Matrix;
    truth: number[];
    weights: number[];
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function mse(preds: number[], truth: number[]): number {
    return preds.reduce((a, v, i) => a + ((v ?? 0) - (truth[i] ?? 0)) ** 2, 0) / preds.length;
}

function reference(input: Input) {
    const m = input.truth.length;
    const combined: number[] = [];
    for (let j = 0; j < m; j += 1) {
        let sum = 0;
        for (let i = 0; i < input.weights.length; i += 1) {
            sum += (input.weights[i] ?? 0) * (input.predictions[i]?.[j] ?? 0);
        }
        combined.push(sum);
    }
    const modelMse = input.predictions.map((p) => mse(p, input.truth));
    return { combined, modelMse, combinedMse: mse(combined, input.truth) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Stacking", () => {
    it("matches an independent weighted-combination computation", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const combined = final?.["combined"] as number[];
        combined.forEach((v, i) => expect(close(v, expected.combined[i]!)).toBe(true));
        expect(final?.["modelMse"]).toEqual(expected.modelMse);
        expect(close(final?.["combinedMse"] as number, expected.combinedMse)).toBe(true);
    });

    it("a one-hot meta weight reproduces exactly that base model", () => {
        const input: Input = {
            predictions: [[1, 2], [5, 5]],
            truth: [1, 2],
            weights: [1, 0],
        };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["combined"]).toEqual([1, 2]);
        expect(final?.["combinedMse"]).toBe(0);
        expect(final?.["modelMse"]).toEqual([0, 12.5]);
    });

    it("equal weights reduce to a plain average", () => {
        const frames = [...mod.run({
            predictions: [[2, 4], [4, 8]],
            truth: [0, 0],
            weights: [0.5, 0.5],
        })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["combined"]).toEqual([3, 6]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
