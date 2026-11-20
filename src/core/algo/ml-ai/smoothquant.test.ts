/**
 * smoothquant.test.ts - Scale formula, int8 bounds, product preservation, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { quantizeSymmetric, smoothQuant, smoothQuantScales } from "./smoothquant";
import type { VisualFrame } from "@/types";

type Input = { weights: number[][]; x: number[]; alpha: number };

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SmoothQuant", () => {
    it("computes the migration scale from activation over weight magnitude", () => {
        const W = [[0.5, 2], [-0.25, 1]];
        const x = [3, -4];
        const s = smoothQuantScales(W, x, 0.5);
        expect(s[0]).toBeCloseTo(Math.pow(3, 0.5) / Math.pow(0.5, 0.5), 9);
        expect(s[1]).toBeCloseTo(Math.pow(4, 0.5) / Math.pow(2, 0.5), 9);
    });

    it("keeps int8 codes in range and reconstructs values", () => {
        const values = [0.9, -1.5, 0, 2.3, -0.2];
        const q = quantizeSymmetric(values);
        q.q.forEach((code) => {
            expect(code).toBeGreaterThanOrEqual(-127);
            expect(code).toBeLessThanOrEqual(127);
        });
        values.forEach((value, i) => expect(q.dequantized[i] ?? 0).toBeCloseTo(value, 1));
    });

    it("preserves the product up to a small quantization error", () => {
        const input = mod.defaultInput as Input;
        const r = smoothQuant(input.weights, input.x, input.alpha);
        const exactProduct = input.weights.map((row) => row.reduce((s, w, j) => s + w * (input.x[j] ?? 0), 0));
        r.exact.forEach((v, i) => expect(v).toBeCloseTo(exactProduct[i] ?? 0, 9));
        expect(r.maxError).toBeLessThan(0.05);
        r.approx.forEach((v, i) => expect(v).toBeCloseTo(r.exact[i] ?? 0, 1));
    });

    it("reports scales and error in metadata and emits well-formed frames", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        const expected = smoothQuant(input.weights, input.x, input.alpha);
        const metaScales = finalMeta?.["scales"] as number[];
        expected.scales.forEach((v, i) => expect(metaScales[i] ?? 0).toBeCloseTo(v, 6));
        expect(Number(finalMeta?.["maxError"])).toBeCloseTo(expected.maxError, 6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
