/** spinquant.test.ts - Hadamard orthogonality, FWHT equivalence, quantization bounds, frames. */
import { describe, expect, it } from "vitest";
import mod, { fwht, hadamardMatrix, quantizeRow, spinQuant } from "./spinquant";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("SpinQuant", () => {
    it("fast Hadamard transform matches dense matrix multiplication", () => {
        const H = hadamardMatrix(8);
        const vector = [1, -2, 3, 0.5, -1.5, 2.5, 4, -3];
        const expected = H.map((row) => row.reduce((s, h, j) => s + h * (vector[j] ?? 0), 0));
        fwht(vector).forEach((v, i) => expect(v).toBeCloseTo(expected[i] ?? 0, 10));
    });

    it("Hadamard matrix is orthogonal up to the order factor", () => {
        const H = hadamardMatrix(4);
        for (let i = 0; i < 4; i += 1) {
            for (let j = 0; j < 4; j += 1) {
                let dot = 0;
                for (let k = 0; k < 4; k += 1) dot += (H[i]?.[k] ?? 0) * (H[j]?.[k] ?? 0);
                expect(dot).toBe(i === j ? 4 : 0);
            }
        }
    });

    it("per-row quantization bounds the error by half a scale", () => {
        const row = [0.31, -0.82, 0.07, 0.45];
        const { codes, dequant, scale } = quantizeRow(row, 4);
        codes.forEach((q) => expect(Math.abs(q)).toBeLessThanOrEqual(7));
        row.forEach((v, i) => expect(Math.abs((dequant[i] ?? 0) - v)).toBeLessThanOrEqual(scale / 2 + 1e-12));
    });

    it("selects the rotation with the smallest measured error", () => {
        const input = mod.defaultInput as { weights: number[][]; bits: number; candidates: string[] };
        const result = spinQuant(input.weights, input.bits, input.candidates);
        const min = Math.min(...result.errors);
        expect(result.errors[result.chosenIndex]).toBeCloseTo(min, 12);
        result.matrix.forEach((row) => row.forEach((v) => expect(Number.isFinite(v)).toBe(true)));
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
