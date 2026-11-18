/** layer-normalization.test.ts - Correctness and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./layer-normalization";
import type { VisualFrame } from "@/types";

interface Input {
    x: number[];
    gamma: number[];
    beta: number[];
    eps: number;
}

/** Independent layer normalization reference. */
function reference(input: Input) {
    const d = input.x.length;
    const mean = input.x.reduce((sum, v) => sum + v, 0) / d;
    const variance = input.x.reduce((sum, v) => sum + (v - mean) ** 2, 0) / d;
    const std = Math.sqrt(variance + input.eps);
    const normalized = input.x.map((v) => (v - mean) / std);
    const output = normalized.map((v, i) => v * (input.gamma[i] ?? 1) + (input.beta[i] ?? 0));
    return { mean, variance, normalized, output };
}

function checkFrames(frames: VisualFrame[], featureCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(featureCount);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Layer normalization", () => {
    it("matches an independent normalization reference", () => {
        const cases: Input[] = [
            { x: [1, 2, 3, 4, 5], gamma: [1, 1, 1, 1, 1], beta: [0, 0, 0, 0, 0], eps: 1e-5 },
            { x: [-2, 0, 4], gamma: [2, 2, 2], beta: [1, 1, 1], eps: 1e-5 },
            { x: [10, 10, 10, 10], gamma: [1, 1, 1, 1], beta: [0, 0, 0, 0], eps: 1e-5 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.x.length);
            const expected = reference(input);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(Number(finalMeta?.["mean"])).toBeCloseTo(expected.mean, 4);
            expect(Number(finalMeta?.["variance"])).toBeCloseTo(expected.variance, 4);
            const normalized = finalMeta?.["normalized"] as number[];
            const output = finalMeta?.["output"] as number[];
            expected.normalized.forEach((v, i) => expect(normalized[i]).toBeCloseTo(v, 4));
            expected.output.forEach((v, i) => expect(output[i]).toBeCloseTo(v, 4));
        }
    });

    it("yields zero-mean unit-variance values before scale and shift", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const normalized = frames[frames.length - 1]?.meta["normalized"] as number[];
        const mean = normalized.reduce((sum, v) => sum + v, 0) / normalized.length;
        const variance = normalized.reduce((sum, v) => sum + (v - mean) ** 2, 0) / normalized.length;
        expect(mean).toBeCloseTo(0, 4);
        expect(variance).toBeCloseTo(1, 4);
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
