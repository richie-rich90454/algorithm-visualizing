/**
 * lora-plus.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./lora-plus";
import type { VisualFrame } from "@/types";

type Input = {
    baseWeight: number[][];
    A: number[][];
    B: number[][];
    bias: number[];
    input: number[];
    alpha: number;
    rank: number;
};

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

function mul(m: number[][], v: number[]): number[] {
    return m.map((row) => row.reduce((a, w, j) => a + w * (v[j] ?? 0), 0));
}

describe("LoRA Plus", () => {
    it("matches a brute-force three-term forward pass and the merge identity", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const scale = input.alpha / input.rank;
        const BA = input.B.map((row) => (input.A[0] ?? []).map((_, j) => row.reduce((s, w, t) => s + w * (input.A[t]?.[j] ?? 0), 0)));
        const delta = BA.map((row) => row.map((v) => v * scale));
        const expected = mul(input.baseWeight, input.input)
            .map((v, i) => v + (mul(delta, input.input)[i] ?? 0) + (input.bias[i] ?? 0));
        const final = frames[frames.length - 1]?.meta;
        const output = final?.["output"] as number[];
        expected.forEach((value, i) => expect(output[i]).toBeCloseTo(value, 5));
        expect(Number(final?.["maxError"])).toBeLessThan(1e-9);
    });

    it("the bias term shifts the output without changing the delta", () => {
        const input = mod.defaultInput as Input;
        const noBias = [...mod.run({ ...input, bias: [0, 0] })];
        const withBias = [...mod.run({ ...input, bias: [1, -1] })];
        const a = noBias[noBias.length - 1]?.meta["output"] as number[];
        const b = withBias[withBias.length - 1]?.meta["output"] as number[];
        expect((b[0] ?? 0) - (a[0] ?? 0)).toBeCloseTo(1, 6);
        expect((b[1] ?? 0) - (a[1] ?? 0)).toBeCloseTo(-1, 6);
        expect(noBias[2]?.meta["delta"]).toEqual(withBias[2]?.meta["delta"]);
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
