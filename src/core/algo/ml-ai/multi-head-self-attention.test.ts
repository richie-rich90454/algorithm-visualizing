/**
 * multi-head-self-attention.test.ts - Independent attention recomputation,
 * softmax properties, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./multi-head-self-attention";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(n);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

interface Weights {
    Wq: number[][][];
    Wk: number[][][];
    Wv: number[][][];
    Wo: number[][];
}

/** Rebuild attention and outputs directly from the reported weights. */
function recompute(
    tokens: number[][],
    heads: number,
    dk: number,
    weights: Weights,
): { attention: number[][][]; output: number[][] } {
    const n = tokens.length;
    const dModel = tokens[0].length;
    const attention: number[][][] = [];
    const concat: number[][] = Array.from({ length: n }, () => Array(heads * dk).fill(0));
    for (let h = 0; h < heads; h += 1) {
        const proj = (W: number[][][]): number[][] =>
            tokens.map((tok) =>
                Array.from({ length: dk }, (_u, k) => tok.reduce((s, x, d) => s + x * W[h][d][k], 0)),
            );
        const Q = proj(weights.Wq);
        const K = proj(weights.Wk);
        const V = proj(weights.Wv);
        const scores: number[][] = [];
        for (let i = 0; i < n; i += 1) {
            scores[i] = [];
            for (let j = 0; j < n; j += 1) {
                let score = 0;
                for (let k = 0; k < dk; k += 1) score += Q[i][k] * K[j][k];
                scores[i][j] = score / Math.sqrt(dk);
            }
        }
        const map: number[][] = [];
        for (let i = 0; i < n; i += 1) {
            const max = Math.max(...scores[i]);
            const exp = scores[i].map((s) => Math.exp(s - max));
            const sum = exp.reduce((a, b) => a + b, 0);
            map[i] = exp.map((e) => e / sum);
        }
        attention.push(map);
        for (let i = 0; i < n; i += 1) {
            for (let k = 0; k < dk; k += 1) {
                let value = 0;
                for (let j = 0; j < n; j += 1) value += map[i][j] * V[j][k];
                concat[i][h * dk + k] = value;
            }
        }
    }
    const output: number[][] = Array.from({ length: n }, () => Array(dModel).fill(0));
    // Explicit projection of the concatenated head outputs.
    for (let i = 0; i < n; i += 1) {
        for (let o = 0; o < dModel; o += 1) {
            let value = 0;
            for (let p = 0; p < heads * dk; p += 1) value += concat[i][p] * weights.Wo[p][o];
            output[i][o] = value;
        }
    }
    return { attention, output };
}

describe("MultiHeadSelfAttention", () => {
    it("matches an independent attention recomputation on the default input", () => {
        const input = mod.defaultInput as { tokens: number[][]; heads: number; dk: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.tokens.length);
        const final = frames[frames.length - 1]?.meta;
        const weights = JSON.parse(String(final?.["weights"])) as Weights;
        const expected = recompute(input.tokens, input.heads, input.dk, weights);
        const actualOutput = final?.["output"] as number[];
        expected.output.flat().forEach((value, i) => {
            expect(actualOutput[i]).toBeCloseTo(value, 9);
        });
        const actualAttention = final?.["attention"] as number[];
        expected.attention[0].flat().forEach((value, i) => {
            expect(actualAttention[i]).toBeCloseTo(value, 9);
        });
    });

    it("keeps every attention row a valid probability distribution", () => {
        const tokens = [
            [2, -1],
            [0, 3],
            [1, 1],
            [-2, 0],
        ];
        const frames = [...mod.run({ tokens, heads: 3, dk: 2, seed: 41 })];
        checkFrames(frames, tokens.length);
        for (let h = 0; h < 3; h += 1) {
            const meta = frames[h + 1]?.meta;
            const flat = meta?.["attention"] as number[];
            const sums = meta?.["rowSums"] as number[];
            expect(sums.length).toBe(tokens.length);
            sums.forEach((sum) => expect(sum).toBeCloseTo(1, 9));
            flat.forEach((value) => {
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1);
            });
        }
    });

    it("gives uniform attention when all queries and keys are zero", () => {
        const tokens = [
            [0, 0],
            [0, 0],
            [0, 0],
        ];
        const frames = [...mod.run({ tokens, heads: 2, dk: 2 })];
        checkFrames(frames, tokens.length);
        const attention = frames[1]?.meta["attention"] as number[];
        attention.forEach((value) => expect(value).toBeCloseTo(1 / 3, 9));
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
