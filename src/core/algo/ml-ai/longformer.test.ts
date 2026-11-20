/** longformer.test.ts - Brute-force mask, row normalization, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { longformerAttention, longformerMask } from "./longformer";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Longformer", () => {
    it("builds a symmetric window-plus-global mask", () => {
        const n = 6;
        const mask = longformerMask(n, 1, [0, 5]);
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                const expected = Math.abs(i - j) <= 1 || i === 0 || j === 0 || i === 5 || j === 5;
                expect(mask[i]?.[j]).toBe(expected);
                expect(mask[i]?.[j]).toBe(mask[j]?.[i]);
            }
        }
    });

    it("normalizes each attention row and zeros masked weights", () => {
        const tokens = [[1, 0], [0, 1], [1, 1], [0.5, 0.5], [1, 0.2], [0.2, 1]];
        const { mask, weights, output } = longformerAttention(tokens, 1, [0, 5]);
        weights.forEach((row, i) => {
            expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
            row.forEach((weight, j) => {
                if (!mask[i]?.[j]) expect(weight).toBe(0);
            });
        });
        expect(weights[5]?.every((w) => w > 0)).toBe(true);
        output.forEach((row) => row.forEach((v) => expect(Number.isFinite(v)).toBe(true)));
    });

    it("matches a brute-force weighted average on the final frame", () => {
        const input = mod.defaultInput as { tokens: number[][]; window: number; globals: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const { mask, weights, output } = longformerAttention(input.tokens, input.window, input.globals);
        const final = frames[frames.length - 1]?.meta;
        (final?.["mask"] as boolean[][]).forEach((row, i) => row.forEach((v, j) => expect(v).toBe(mask[i]?.[j])));
        const gotOutput = final?.["output"] as number[];
        output.flat().forEach((v, i) => expect(gotOutput[i]).toBeCloseTo(v, 10));
        weights.flat().forEach((v, i) => expect((final?.["weights"] as number[])[i]).toBeCloseTo(v, 10));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
