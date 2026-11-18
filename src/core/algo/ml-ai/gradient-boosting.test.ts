/** gradient-boosting.test.ts - Correctness and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./gradient-boosting";
import type { VisualFrame } from "@/types";

function mse(predictions: number[], y: number[]): number {
    return y.reduce((sum, value, i) => sum + (value - predictions[i]!) ** 2, 0) / y.length;
}

/** Independent boosting reference with a scaled-residual weak learner. */
function reference(y: number[], rounds: number, lr: number) {
    const mean = y.reduce((sum, v) => sum + v, 0) / y.length;
    const predictions = new Array<number>(y.length).fill(mean);
    for (let round = 0; round < rounds; round += 1) {
        for (let i = 0; i < y.length; i += 1) {
            predictions[i] = predictions[i]! + lr * (y[i]! - predictions[i]!);
        }
    }
    return predictions;
}

function checkFrames(frames: VisualFrame[], sampleCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(sampleCount);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Gradient boosting", () => {
    it("matches an independent boosting reference", () => {
        const cases = [
            { y: [2, 4, 6, 8], rounds: 4, lr: 0.5 },
            { y: [1, 3, 2, 5, 4], rounds: 6, lr: 0.3 },
            { y: [-2, 0, 7], rounds: 3, lr: 0.8 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ y: testCase.y, rounds: testCase.rounds, learningRate: testCase.lr })];
            checkFrames(frames, testCase.y.length);
            const expected = reference(testCase.y, testCase.rounds, testCase.lr);
            const finalPredictions = frames[frames.length - 1]?.meta["predictions"] as number[];
            expected.forEach((value, index) => {
                expect(finalPredictions[index]).toBeCloseTo(value, 4);
            });
        }
    });

    it("starts at the mean and reduces mean squared error", () => {
        const y = [2, 4, 6, 8];
        const frames = [...mod.run({ y, rounds: 5, learningRate: 0.5 })];
        const first = frames[0]?.meta["predictions"] as number[];
        expect(first.every((v) => v === 5)).toBe(true);
        for (let i = 1; i < frames.length; i += 1) {
            expect(Number(frames[i]?.meta["mse"])).toBeLessThanOrEqual(Number(frames[i - 1]?.meta["mse"]) + 1e-9);
        }
        expect(mse(frames[frames.length - 1]?.meta["predictions"] as number[], y)).toBeLessThan(mse(first, y));
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
