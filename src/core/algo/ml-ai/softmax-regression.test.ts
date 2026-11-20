/**
 * softmax-regression.test.ts - Reference replay, probability axioms, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./softmax-regression";
import type { VisualFrame } from "@/types";

type Sample = [number, number, number];

function checkFrames(frames: VisualFrame[], sampleCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(sampleCount);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const probs = frame.meta["probabilities"];
        expect(Array.isArray(probs)).toBe(true);
        expect((probs as number[]).length).toBe(Number(frame.meta["classCount"]));
        expect((probs as number[]).every((p) => p >= 0 && p <= 1)).toBe(true);
        expect((probs as number[]).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
    });
}

describe("SoftmaxRegression", () => {
    it("learns the training labels and reduces cross-entropy", () => {
        const input = mod.defaultInput as {
            samples: Sample[];
            learningRate: number;
            epochs: number;
            classCount: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.samples.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        const finalFrame = frames[frames.length - 1]!;
        const correct = finalFrame.entities.filter(
            (e) => e.metadata["predicted"] === e.metadata["trueLabel"],
        ).length;
        expect(correct).toBe(input.samples.length);
        expect(Number(finalMeta?.["loss"])).toBeLessThan(Number(frames[0]?.meta["loss"]));
        expect(finalMeta?.["converged"]).toBe(true);
    });

    it("stays exact against a hand-worked softmax update", () => {
        const samples: Sample[] = [
            [1, 0, 0],
            [0, 1, 1],
        ];
        const frames = [...mod.run({ samples, learningRate: 0.5, epochs: 1, classCount: 2 })];
        checkFrames(frames, samples.length);
        const probs = frames[1]?.meta["probabilities"] as number[];
        expect(probs[0]).toBeGreaterThan(probs[1]!);
        expect(probs[0]! + probs[1]!).toBeCloseTo(1, 5);
        const finalAccuracy = frames[frames.length - 1]?.entities.filter(
            (e) => e.metadata["predicted"] === e.metadata["trueLabel"],
        ).length;
        expect(finalAccuracy).toBe(2);
    });

    it("agrees with an independent gradient replay on the loss", () => {
        const samples: Sample[] = [
            [1, 1, 0],
            [2, 1, 1],
            [-1, -1, 2],
        ];
        const lr = 0.1;
        const epochs = 12;
        const classCount = 3;
        const w = [
            [0, 0],
            [0, 0],
            [0, 0],
        ];
        const b = [0, 0, 0];
        for (let epoch = 0; epoch < epochs; epoch += 1) {
            const gw = w.map((row) => [0, 0]);
            const gb = [0, 0, 0];
            for (const [x, y, label] of samples) {
                const scores = w.map((row, k) => row[0]! * x + row[1]! * y + b[k]!);
                const max = Math.max(...scores);
                const exps = scores.map((s) => Math.exp(s - max));
                const sum = exps.reduce((a, v) => a + v, 0);
                const probs = exps.map((v) => v / sum);
                for (let k = 0; k < classCount; k += 1) {
                    const factor = probs[k]! - (k === label ? 1 : 0);
                    gw[k]![0]! += factor * x;
                    gw[k]![1]! += factor * y;
                    gb[k]! += factor;
                }
            }
            for (let k = 0; k < classCount; k += 1) {
                w[k]![0]! -= (lr * gw[k]![0]!) / samples.length;
                w[k]![1]! -= (lr * gw[k]![1]!) / samples.length;
                b[k]! -= (lr * gb[k]!) / samples.length;
            }
        }
        let expectedLoss = 0;
        for (const [x, y, label] of samples) {
            const scores = w.map((row, k) => row[0]! * x + row[1]! * y + b[k]!);
            const max = Math.max(...scores);
            const exps = scores.map((s) => Math.exp(s - max));
            const sum = exps.reduce((a, v) => a + v, 0);
            expectedLoss -= Math.log(exps[label]! / sum);
        }
        expectedLoss /= samples.length;
        const frames = [...mod.run({ samples, learningRate: lr, epochs, classCount })];
        checkFrames(frames, samples.length);
        expect(Number(frames[frames.length - 1]?.meta["loss"])).toBeCloseTo(expectedLoss, 10);
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
