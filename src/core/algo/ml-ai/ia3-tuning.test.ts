/**
 * ia3-tuning.test.ts - Brute-force scaling, zero-scale identity, finite-difference gradient, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { ia3Forward, ia3Step } from "./ia3-tuning";
import type { VisualFrame } from "@/types";

type Input = { weights: number[][]; x: number[]; alpha: number[]; target: number[]; lr: number };

const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);

function loss(weights: number[][], x: number[], alpha: number[], target: number[]): number {
    return ia3Forward(weights, x, alpha).output.reduce(
        (sum, value, i) => sum + 0.5 * (value - (target[i] ?? 0)) ** 2,
        0,
    );
}

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

describe("IA3 Tuning", () => {
    it("matches a brute-force scaled forward pass", () => {
        const input = mod.defaultInput as Input;
        const { base, output } = ia3Forward(input.weights, input.x, input.alpha);
        base.forEach((value, i) => expect(value).toBeCloseTo(dot(input.weights[i] ?? [], input.x), 9));
        output.forEach((value, i) => expect(value).toBeCloseTo(base[i]! * (1 + input.alpha[i]!), 9));
    });

    it("equals the frozen base when scales are zero", () => {
        const input = mod.defaultInput as Input;
        const zeros = input.alpha.map(() => 0);
        const { base, output } = ia3Forward(input.weights, input.x, zeros);
        output.forEach((value, i) => expect(value).toBeCloseTo(base[i] ?? 0, 12));
    });

    it("scale gradients match central finite differences", () => {
        const input = mod.defaultInput as Input;
        const r = ia3Step(input.weights, input.x, input.alpha, input.target, input.lr);
        const h = 1e-6;
        r.gradAlpha.forEach((gradient, i) => {
            const plus = input.alpha.map((v, k) => (k === i ? v + h : v));
            const minus = input.alpha.map((v, k) => (k === i ? v - h : v));
            const finite = (loss(input.weights, input.x, plus, input.target) - loss(input.weights, input.x, minus, input.target)) / (2 * h);
            expect(gradient).toBeCloseTo(finite, 6);
        });
    });

    it("reports loss decrease in metadata and emits well-formed frames", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.weights.length);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["frozenWeights"]).toBe(input.weights.length * input.x.length);
        expect(finalMeta?.["trainableScales"]).toBe(input.weights.length);
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
