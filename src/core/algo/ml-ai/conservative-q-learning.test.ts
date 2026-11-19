/**
 * conservative-q-learning.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./conservative-q-learning";
import type { VisualFrame } from "@/types";

type Input = { inDistribution: number[]; outOfDistribution: number[]; targets: number[]; alpha: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function referenceLse(values: number[]): number {
    const max = Math.max(...values);
    return max + Math.log(values.reduce((a, v) => a + Math.exp(v - max), 0));
}

describe("Conservative Q-Learning", () => {
    it("matches a brute-force log-sum-exp penalty and loss", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const all = [...input.inDistribution, ...input.outOfDistribution];
        const lse = referenceLse(all);
        const dataMean = input.inDistribution.reduce((a, v) => a + v, 0) / input.inDistribution.length;
        const penalty = lse - dataMean;
        const mse = input.inDistribution.reduce(
            (sum, value, i) => sum + (value - (input.targets[i] ?? 0)) ** 2,
            0,
        ) / input.inDistribution.length;
        const loss = mse + input.alpha * penalty;
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["lse"])).toBeCloseTo(lse, 4);
        expect(Number(final?.["penalty"])).toBeCloseTo(penalty, 4);
        expect(Number(final?.["mse"])).toBeCloseTo(mse, 4);
        expect(Number(final?.["loss"])).toBeCloseTo(loss, 4);
        expect(penalty).toBeGreaterThan(0);
    });

    it("the penalty grows when out-of-distribution values are inflated", () => {
        const low = [...mod.run({ inDistribution: [1, 2], outOfDistribution: [3], targets: [1, 2], alpha: 1 })];
        const high = [...mod.run({ inDistribution: [1, 2], outOfDistribution: [30], targets: [1, 2], alpha: 1 })];
        const pLow = Number(low[low.length - 1]?.meta["penalty"]);
        const pHigh = Number(high[high.length - 1]?.meta["penalty"]);
        expect(pHigh).toBeGreaterThan(pLow);
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
