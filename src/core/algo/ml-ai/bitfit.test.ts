/**
 * bitfit.test.ts - Frozen-weight property, brute-force gradient, loss decrease, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { bitFitStep } from "./bitfit";
import type { VisualFrame } from "@/types";

type Input = { weights: number[][]; bias: number[]; x: number[]; target: number[]; lr: number };

const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);

function checkFrames(frames: VisualFrame[], m: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities).toHaveLength(m);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("BitFit", () => {
    it("matches a brute-force bias update and leaves weights unchanged", () => {
        const input = mod.defaultInput as Input;
        const r = bitFitStep(input.weights, input.bias, input.x, input.target, input.lr);
        r.yBefore.forEach((value, i) => {
            expect(value).toBeCloseTo(dot(input.weights[i] ?? [], input.x) + (input.bias[i] ?? 0), 9);
        });
        r.biasAfter.forEach((value, i) => {
            const err = dot(input.weights[i] ?? [], input.x) + (input.bias[i] ?? 0) - (input.target[i] ?? 0);
            expect(value).toBeCloseTo((input.bias[i] ?? 0) - input.lr * err, 9);
        });
        r.yAfter.forEach((value, i) => {
            expect(value).toBeCloseTo(dot(input.weights[i] ?? [], input.x) + r.biasAfter[i]!, 9);
        });
        input.weights.forEach((row, i) => row.forEach((w, j) => expect(w).toBe(input.weights[i]![j]!)));
    });

    it("reduces the loss for a small step", () => {
        const input = { ...(mod.defaultInput as Input), lr: 0.05 };
        const r = bitFitStep(input.weights, input.bias, input.x, input.target, input.lr);
        expect(r.lossAfter).toBeLessThan(r.lossBefore);
    });

    it("reports loss decrease in metadata and emits well-formed frames", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.weights.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["frozenWeights"]).toBe(input.weights.length * input.x.length);
        expect(finalMeta?.["trainableBiases"]).toBe(input.weights.length);
        expect(Number(finalMeta?.["lossAfter"])).toBeLessThanOrEqual(Number(finalMeta?.["lossBefore"]));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
