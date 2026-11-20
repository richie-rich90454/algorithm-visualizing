/**
 * quantization-aware-training.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { fakeQuantize } from "./quantization-aware-training";
import type { VisualFrame } from "@/types";

type Input = {
    weights: number[]; bits: number; scale: number; zeroPoint: number;
    gradients: number[]; learningRate: number;
};

function reference(input: Input) {
    const qmin = -(2 ** (input.bits - 1));
    const qmax = 2 ** (input.bits - 1) - 1;
    const levels = input.weights.map((x) =>
        Math.min(qmax, Math.max(qmin, Math.round(x / input.scale) + input.zeroPoint)));
    const dequant = levels.map((q) => (q - input.zeroPoint) * input.scale);
    const mse = input.weights.reduce((s, x, i) => s + (x - dequant[i]!) ** 2, 0) / input.weights.length;
    const weightsAfter = input.weights.map((x, i) => x - input.learningRate * input.gradients[i]!);
    return { qmin, qmax, levels, dequant, mse, weightsAfter };
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Quantization-Aware Training", () => {
    const makeInput = (seed: number): Input => {
        const weights = Array.from({ length: 3 + (seed % 6) }, (_, i) => ((seed * (i + 2)) % 21) / 6 - 1.7);
        const bits = 2 + (seed % 5);
        const qmax = 2 ** (bits - 1) - 1;
        return {
            weights,
            bits,
            scale: Math.max(...weights.map(Math.abs)) / qmax,
            zeroPoint: seed % 3 === 0 ? 1 : 0,
            gradients: weights.map((_x, i) => ((seed + i) % 7) / 10 - 0.3),
            learningRate: 0.1,
        };
    };

    it("matches an independent fake-quantizer on random inputs", () => {
        for (let seed = 1; seed <= 25; seed += 1) {
            const input = makeInput(seed);
            const frames = [...mod.run(input)];
            checkFrames(frames, input.weights.length, 4);
            const expected = reference(input);
            const final = frames[frames.length - 1]!.meta;
            expect(Number(final["scale"])).toBeCloseTo(input.scale, 10);
            expect(final["qmin"]).toBe(expected.qmin);
            expect(final["qmax"]).toBe(expected.qmax);
            (final["levels"] as number[]).forEach((v, i) => expect(v).toBe(expected.levels[i]));
            (final["dequant"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.dequant[i]!, 10));
            expect(Number(final["mse"])).toBeCloseTo(expected.mse, 10);
            const after = final["weightsAfter"] as number[];
            after.forEach((v, i) => expect(v).toBeCloseTo(expected.weightsAfter[i]!, 10));
        }
    });

    it("levels stay in range and error is nonnegative", () => {
        const input = makeInput(7);
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]!.meta;
        const levels = final["levels"] as number[];
        levels.forEach((q) => {
            expect(q).toBeGreaterThanOrEqual(Number(final["qmin"]));
            expect(q).toBeLessThanOrEqual(Number(final["qmax"]));
        });
        expect(Number(final["mse"])).toBeGreaterThanOrEqual(0);
        // A weight already on the grid reconstructs exactly.
        expect(fakeQuantize(0.5, 0.5, 0, -4, 3).value).toBeCloseTo(0.5, 12);
    });

    it("abstains from a step without gradients", () => {
        const frames = [...mod.run({ weights: [0.4, -0.6], bits: 4 })];
        const final = frames[frames.length - 1]!.meta;
        expect(final["weightsAfter"]).toBeUndefined();
        expect(final["stepped"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
