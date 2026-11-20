/**
 * mini-batch-gradient-descent.test.ts - Independent gradient reference,
 * convergence property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./mini-batch-gradient-descent";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent replay of the parameter updates using explicit sums. */
function reference(
    xs: number[],
    ys: number[],
    lr: number,
    batchSize: number,
    epochs: number,
): Array<{ w: number; b: number }> {
    const trace: Array<{ w: number; b: number }> = [];
    let w = 0;
    let b = 0;
    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        for (let start = 0; start < xs.length; start += batchSize) {
            const end = Math.min(xs.length, start + batchSize);
            let sw = 0;
            let sb = 0;
            for (let i = start; i < end; i += 1) {
                const e = w * xs[i] + b - ys[i];
                sw += e * xs[i];
                sb += e;
            }
            w -= lr * ((2 * sw) / (end - start));
            b -= lr * ((2 * sb) / (end - start));
            trace.push({ w, b });
        }
    }
    return trace;
}

describe("MiniBatchGradientDescent", () => {
    it("matches an independently summed gradient trace on the default input", () => {
        const input = mod.defaultInput as {
            xs: number[];
            ys: number[];
            learningRate: number;
            batchSize: number;
            epochs: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.xs.length);
        const trace = reference(input.xs, input.ys, input.learningRate, input.batchSize, input.epochs);
        // frames[0] is setup, then one frame per batch update, then the summary.
        expect(frames.length).toBe(trace.length + 2);
        trace.forEach((expected, k) => {
            const meta = frames[k + 1]?.meta;
            expect(meta?.["w"]).toBeCloseTo(expected.w, 9);
            expect(meta?.["b"]).toBeCloseTo(expected.b, 9);
        });
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["w"]).toBeCloseTo(trace[trace.length - 1].w, 9);
        expect(final?.["b"]).toBeCloseTo(trace[trace.length - 1].b, 9);
    });

    it("converges on a perfect line with full batches", () => {
        const xs = [0, 1, 2, 3, 4, 5];
        const ys = xs.map((x) => 2 * x + 1);
        const frames = [...mod.run({ xs, ys, learningRate: 0.05, batchSize: xs.length, epochs: 400 })];
        checkFrames(frames, xs.length);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["w"])).toBeCloseTo(2, 4);
        expect(Number(final?.["b"])).toBeCloseTo(1, 4);
        expect(Number(final?.["loss"])).toBeLessThan(1e-6);
    });

    it("batch size one reproduces stochastic-style updates that still reduce loss", () => {
        const xs = [0, 1, 2, 3, 4, 5];
        const ys = xs.map((x) => 3 * x - 2);
        const frames = [...mod.run({ xs, ys, learningRate: 0.02, batchSize: 1, epochs: 60 })];
        checkFrames(frames, xs.length);
        const initialLoss = Number(frames[0]?.meta["loss"]);
        const finalLoss = Number(frames[frames.length - 1]?.meta["loss"]);
        expect(finalLoss).toBeLessThan(initialLoss);
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
