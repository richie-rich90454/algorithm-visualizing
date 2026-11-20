/** lsh-attention.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod, { lshAttention, lshBuckets } from "./lsh-attention";
import type { VisualFrame } from "@/types";

interface Vec { q: number[]; k: number[]; v: number[] }

/** Independent copy of the deterministic hash used to cross-check buckets. */
function referenceBuckets(vectors: number[][], buckets: number, seed: number): number[] {
    const dir = vectors[0].map((_, k) => Math.sin((k + 1) * 12.9898 + seed * 78.233) * 43758.5453 % 1);
    return vectors.map((vec) => {
        let projected = 0;
        vec.forEach((value, i) => { projected += value * (dir[i] ?? 0); });
        const frac = projected - Math.floor(projected);
        return Math.min(buckets - 1, Math.floor(frac * buckets));
    });
}

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0);
}

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

describe("LSH Attention", () => {
    it("matches an independently computed bucketed attention", () => {
        const input = mod.defaultInput as { tokens: Vec[]; buckets: number; seed: number };
        const { tokens, buckets, seed } = input;
        const frames = [...mod.run(input)];
        checkFrames(frames, tokens.length, tokens.length);

        const keyBuckets = referenceBuckets(tokens.map((t) => t.k), buckets, seed);
        const queryBuckets = referenceBuckets(tokens.map((t) => t.q), buckets, seed);
        expect(lshBuckets(tokens.map((t) => t.k), buckets, seed)).toEqual(keyBuckets);

        const result = lshAttention(tokens, buckets, seed);
        const dim = tokens[0].q.length;
        for (let i = 0; i < tokens.length; i += 1) {
            const allowed: number[] = [];
            for (let j = 0; j < tokens.length; j += 1) {
                if (keyBuckets[j] === queryBuckets[i]) allowed.push(j);
            }
            const scores = allowed.map((j) => dot(tokens[i].q, tokens[j].k) / Math.sqrt(dim));
            const max = Math.max(...scores);
            const exps = scores.map((s) => Math.exp(s - max));
            const sum = exps.reduce((a, b) => a + b, 0);
            const probs = exps.map((e) => e / sum);
            let total = 0;
            for (let j = 0; j < tokens.length; j += 1) {
                const w = result.weights[i][j];
                if (keyBuckets[j] !== queryBuckets[i]) {
                    expect(w).toBe(0);
                } else {
                    const idx = allowed.indexOf(j);
                    expect(w).toBeCloseTo(probs[idx], 10);
                    total += w;
                }
            }
            expect(total).toBeCloseTo(1, 10);
            for (let d = 0; d < dim; d += 1) {
                let expected = 0;
                allowed.forEach((j, idx) => { expected += probs[idx] * tokens[j].v[d]; });
                expect(result.outputs[i][d]).toBeCloseTo(expected, 10);
            }
        }
    });

    it("is deterministic and keeps every query in a nonempty bucket", () => {
        const input = mod.defaultInput as { tokens: Vec[]; buckets: number; seed: number };
        const a = lshAttention(input.tokens, input.buckets, input.seed);
        const b = lshAttention(input.tokens, input.buckets, input.seed);
        expect(a).toEqual(b);
        a.weights.forEach((row) => expect(row.some((w) => w > 0)).toBe(true));
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
