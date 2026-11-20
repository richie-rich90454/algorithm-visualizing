/**
 * batch-normalization.test.ts - Statistical reference check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./batch-normalization";
import type { VisualFrame } from "@/types";

interface Input {
    values: number[];
    gamma: number;
    beta: number;
    eps: number;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("BatchNormalization", () => {
    it("matches an independent standardization on random batches", () => {
        const seeds = [
            [1, 2, 3, 4, 5],
            [-3, 0, 7, 2],
            [10, 10, 10, 10],
            [0.5, -1.5, 2.25, 4, -0.75],
        ];
        for (const values of seeds) {
            const input: Input = { values, gamma: 1.7, beta: -0.3, eps: 1e-5 };
            const frames = [...mod.run(input)];
            checkFrames(frames, values.length);
            const meta = frames[frames.length - 1]?.meta ?? {};
            const n = values.length;
            const mean = values.reduce((a, v) => a + v, 0) / n;
            const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
            const std = Math.sqrt(variance + input.eps);
            expect(Number(meta["mean"])).toBeCloseTo(mean, 9);
            expect(Number(meta["variance"])).toBeCloseTo(variance, 9);
            const normalized = meta["normalized"] as number[];
            const output = meta["output"] as number[];
            for (let i = 0; i < n; i += 1) {
                expect(normalized[i]!).toBeCloseTo((values[i]! - mean) / std, 9);
                expect(output[i]!).toBeCloseTo(input.gamma * normalized[i]! + input.beta, 9);
            }
        }
    });

    it("normalized values have zero mean and near unit variance", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const meta = frames[frames.length - 1]?.meta ?? {};
        const z = meta["normalized"] as number[];
        const mean = z.reduce((a, v) => a + v, 0) / z.length;
        const variance = z.reduce((a, v) => a + (v - mean) ** 2, 0) / z.length;
        expect(mean).toBeCloseTo(0, 6);
        expect(variance).toBeCloseTo(1, 4);
    });

    it("handles a constant batch with finite output", () => {
        const frames = [...mod.run({ values: [5, 5, 5, 5], gamma: 2, beta: 1, eps: 1e-5 })];
        checkFrames(frames, 4);
        const meta = frames[frames.length - 1]?.meta ?? {};
        expect(meta["variance"]).toBe(0);
        for (const v of meta["output"] as number[]) {
            expect(Number.isFinite(v)).toBe(true);
            expect(v).toBeCloseTo(1, 6);
        }
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
