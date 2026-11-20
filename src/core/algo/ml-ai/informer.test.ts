/** informer.test.ts - Independent sparse-attention oracle, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./informer";
import type { VisualFrame } from "@/types";

interface Input {
    queries: number[][];
    keys: number[][];
    values: number[][];
    topK: number;
}

function reference(input: Input) {
    const dim = Math.max(1, input.queries[0]?.length ?? 1);
    const scores = input.queries.map((q) =>
        input.keys.map((k) => {
            let dot = 0;
            for (let d = 0; d < dim; d += 1) dot += (q[d] ?? 0) * (k[d] ?? 0);
            return dot / Math.sqrt(dim);
        }),
    );
    const selected = scores.map((row) =>
        row.map((value, index) => ({ value, index }))
            .sort((a, b) => b.value - a.value || a.index - b.index)
            .slice(0, Math.min(input.topK, row.length))
            .map((item) => item.index),
    );
    const attention = scores.map((row, i) => {
        const chosen = selected[i] ?? [];
        const max = Math.max(...chosen.map((j) => row[j] ?? 0));
        const exps = chosen.map((j) => Math.exp((row[j] ?? 0) - max));
        const total = exps.reduce((a, b) => a + b, 0);
        return exps.map((v) => v / total);
    });
    const output = input.queries.map((_, i) => {
        const result = new Array<number>(input.values[0]?.length ?? 1).fill(0);
        (selected[i] ?? []).forEach((j, k) => {
            for (let d = 0; d < result.length; d += 1) result[d] = (result[d] ?? 0) + (attention[i]?.[k] ?? 0) * (input.values[j]?.[d] ?? 0);
        });
        return result;
    });
    return { scores, selected, attention, output };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Informer ProbSparse Attention", () => {
    it("matches an independent sparse-attention oracle", () => {
        const cases: Input[] = [
            { queries: [[1, 0], [0, 1], [1, 1]], keys: [[1, 0], [0, 1], [1, 1], [-1, 0.5]], values: [[1, 1], [2, 0], [3, 1], [4, 0.5]], topK: 2 },
            { queries: [[2, 1], [1, -1]], keys: [[1, 0], [0, 2], [2, 2]], values: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], topK: 1 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = reference(input);
            const meta = frames[frames.length - 1]?.meta;
            (meta?.["scores"] as number[][]).forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(expected.scores[i]?.[j] ?? 0, 8)));
            expect(meta?.["selected"]).toEqual(expected.selected);
            (meta?.["attention"] as number[][]).forEach((row, i) => row.forEach((v, k) => expect(v).toBeCloseTo(expected.attention[i]?.[k] ?? 0, 8)));
            (meta?.["output"] as number[][]).forEach((row, i) => row.forEach((v, d) => expect(v).toBeCloseTo(expected.output[i]?.[d] ?? 0, 8)));
        }
    });

    it("keeps sparse weights normalized and selects few keys", () => {
        const input: Input = { queries: [[1, 0], [0, 1]], keys: [[1, 0], [0, 1], [1, 1]], values: [[1, 2], [3, 4], [5, 6]], topK: 1 };
        const meta = [...mod.run(input)].at(-1)?.meta;
        const attention = meta?.["attention"] as number[][];
        attention.forEach((row) => expect(row.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8));
        (meta?.["selected"] as number[][]).forEach((row) => expect(row.length).toBe(1));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
