/**
 * iqn.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { cosineEmbedding, quantileReadout, quantileHuber } from "./iqn";
import type { VisualFrame } from "@/types";

type Input = {
    taus: number[]; weights: number[]; bias: number; reward: number;
    gamma: number; done: boolean; nextValues: number[]; kappa: number;
};

function reference(input: Input) {
    const predictions = input.taus.map((t) =>
        input.bias + input.weights.reduce((s, w, i) => s + w * Math.cos(Math.PI * (i + 1) * t), 0));
    const targets = input.taus.map((_t, j) => input.reward + (input.done ? 0 : input.gamma * input.nextValues[j]!));
    const losses = input.taus.map((t, j) => {
        const r = targets[j]! - predictions[j]!;
        const a = Math.abs(r);
        const huber = a < input.kappa ? (0.5 * r * r) / input.kappa : a - 0.5 * input.kappa;
        return Math.abs(t - (r < 0 ? 1 : 0)) * huber;
    });
    return { predictions, targets, losses, mean: losses.reduce((a, b) => a + b, 0) / losses.length };
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

describe("IQN", () => {
    const makeInput = (seed: number): Input => {
        const m = 3 + (seed % 6);
        const d = 2 + (seed % 4);
        return {
            taus: Array.from({ length: m }, (_, i) => (i + 1) / (m + 1)),
            weights: Array.from({ length: d }, (_, i) => ((seed * 3 + i * 5) % 9) / 4 - 1),
            bias: (seed % 5) - 2,
            reward: (seed % 7) - 3,
            gamma: 0.8 + (seed % 3) * 0.05,
            done: seed % 5 === 0,
            nextValues: Array.from({ length: m }, (_, i) => i + seed / 10),
            kappa: 0.5 + (seed % 3) * 0.5,
        };
    };

    it("matches an independent reference on random inputs", () => {
        for (let seed = 1; seed <= 25; seed += 1) {
            const input = makeInput(seed);
            const frames = [...mod.run(input)];
            checkFrames(frames, input.taus.length, 5);
            const expected = reference(input);
            const final = frames[frames.length - 1]!.meta;
            (final["predictions"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.predictions[i]!, 8));
            (final["targets"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.targets[i]!, 8));
            (final["losses"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.losses[i]!, 8));
            expect(Number(final["loss"])).toBeCloseTo(expected.mean, 8);
        }
    });

    it("cosine basis landmarks and nonnegative loss", () => {
        const phi0 = cosineEmbedding(0, 4);
        phi0.forEach((v) => expect(v).toBeCloseTo(1, 10));
        const phi1 = cosineEmbedding(1, 4);
        phi1.forEach((v, i) => expect(v).toBeCloseTo(Math.cos(Math.PI * (i + 1)), 10));
        expect(quantileHuber(0.3, 0, 1)).toBe(0);
        expect(quantileHuber(0.7, -2, 1)).toBeGreaterThan(0);
        expect(quantileReadout(0.25, [1, 2, 3], 5)).toBeCloseTo(
            5 + Math.cos(Math.PI * 0.25) + 2 * Math.cos(Math.PI * 0.5) + 3 * Math.cos(Math.PI * 0.75), 10);
    });

    it("perfect predictions give zero loss", () => {
        const input = makeInput(3);
        const expected = reference(input);
        const exact = quantileHuber(0.5, 0, 1);
        expect(exact).toBe(0);
        expect(expected.losses.every((l) => l >= 0)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
