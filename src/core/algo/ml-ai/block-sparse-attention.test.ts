/** block-sparse-attention.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod, { allowedBlocks, blockOf, blockSparseAttention } from "./block-sparse-attention";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Block Sparse Attention", () => {
    it("matches an independently recomputed masked attention", () => {
        const input = mod.defaultInput as { queries: number[]; keys: number[]; values: number[]; blockSize: number };
        const { queries, keys, values, blockSize } = input;
        const frames = [...mod.run(input)];
        checkFrames(frames, queries.length, queries.length);

        const result = blockSparseAttention(queries, keys, values, blockSize);
        const n = queries.length;
        const numBlocks = Math.ceil(n / blockSize);
        for (let i = 0; i < n; i += 1) {
            const qb = Math.floor(i / blockSize);
            const allowed = new Set<number>();
            allowed.add(qb);
            if (qb > 0) allowed.add(qb - 1);
            if (numBlocks > 1) allowed.add(numBlocks - 1);
            const indices: number[] = [];
            for (let j = 0; j < n; j += 1) if (allowed.has(Math.floor(j / blockSize))) indices.push(j);
            const scores = indices.map((j) => queries[i] * keys[j]);
            const max = Math.max(...scores);
            const exps = scores.map((s) => Math.exp(s - max));
            const sum = exps.reduce((a, b) => a + b, 0);
            const probs = exps.map((e) => e / sum);
            let total = 0;
            let expectedOut = 0;
            indices.forEach((j, idx) => {
                expect(result.weights[i][j]).toBeCloseTo(probs[idx], 10);
                total += result.weights[i][j];
                expectedOut += probs[idx] * values[j];
            });
            for (let j = 0; j < n; j += 1) {
                if (!allowed.has(Math.floor(j / blockSize))) expect(result.weights[i][j]).toBe(0);
            }
            expect(total).toBeCloseTo(1, 10);
            expect(result.outputs[i]).toBeCloseTo(expectedOut, 10);
        }
    });

    it("computes block indices and block links correctly", () => {
        expect(blockOf(0, 2)).toBe(0);
        expect(blockOf(3, 2)).toBe(1);
        expect(allowedBlocks(0, 3)).toEqual([0, 2]);
        expect(allowedBlocks(1, 3)).toEqual([0, 1, 2]);
        expect(allowedBlocks(0, 1)).toEqual([0]);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
