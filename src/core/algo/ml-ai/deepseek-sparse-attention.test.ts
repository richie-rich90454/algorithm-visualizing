/** deepseek-sparse-attention.test.ts - Brute-force top-k, sparse weights, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { sparseAttention, topKIndices } from "./deepseek-sparse-attention";
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

describe("DeepSeek Sparse Attention", () => {
    it("top-k indices match a brute-force sort with stable ties", () => {
        const scores = [1, 5, 5, -2, 3];
        const expected = [...scores]
            .map((score, index) => ({ score, index }))
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .slice(0, 3)
            .map((e) => e.index);
        expect(topKIndices(scores, 3)).toEqual(expected);
        expect(topKIndices(scores, 10).length).toBe(scores.length);
    });

    it("sparse weights are zero off the chosen set and sum to one", () => {
        const q = [[1, 0], [0, 1], [1, 1], [0.5, 0.5]];
        const { selected, weights, output } = sparseAttention(q, q, q, 2);
        weights.forEach((row, i) => {
            expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
            row.forEach((w, j) => {
                if (!(selected[i] ?? []).includes(j)) expect(w).toBe(0);
            });
        });
        output.forEach((row) => row.forEach((v) => expect(Number.isFinite(v)).toBe(true)));
    });

    it("emits well-formed frames matching the reference", () => {
        const input = mod.defaultInput as {
            queries: number[][]; keys: number[][]; values: number[][]; topK: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = sparseAttention(input.queries, input.keys, input.values, input.topK);
        const final = frames[frames.length - 1]?.meta;
        (final?.["selected"] as number[][]).forEach((row, i) => expect(row).toEqual(expected.selected[i]));
        (final?.["output"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.output.flat()[i] ?? 0, 10));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
