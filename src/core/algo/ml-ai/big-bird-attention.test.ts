/**
 * big-bird-attention.test.ts - Sparse mask correctness, full-attention reduction, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { allowedPositions, bigBirdAttention } from "./big-bird-attention";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
type Input = {
    queries: Matrix;
    keys: Matrix;
    values: Matrix;
    globalTokens: number;
    window: number;
    randomTokens: number;
    seed: number;
};

const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);

function fullWeights(Q: Matrix, K: Matrix): Matrix {
    const scale = Math.sqrt(K[0]?.length ?? 1);
    return Q.map((query) => {
        const raw = K.map((key) => dot(query, key) / scale);
        const max = Math.max(...raw);
        const exps = raw.map((v) => Math.exp(v - max));
        const total = exps.reduce((a, b) => a + b, 0);
        return exps.map((v) => v / total);
    });
}

/** Independent reference mask built by scanning every position. */
function referenceAllowed(i: number, n: number, g: number, w: number, r: number, seed: number): Set<number> {
    const set = new Set<number>();
    for (let j = 0; j < n; j += 1) {
        const isGlobal = j < g || j >= n - g;
        const isLocal = Math.abs(j - i) <= w;
        let isRandom = false;
        for (let t = 0; t < r; t += 1) {
            if (j === ((i + 1) * 31 + (t + 1) * 17 + seed) % n) {
                isRandom = true;
            }
        }
        if (isGlobal || isLocal || isRandom) {
            set.add(j);
        }
    }
    return set;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
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

describe("Big Bird Attention", () => {
    it("allowed positions match an independent mask scan", () => {
        const n = 9;
        for (let i = 0; i < n; i += 1) {
            expect(allowedPositions(i, n, 2, 1, 2, 5)).toEqual(
                [...referenceAllowed(i, n, 2, 1, 2, 5)].sort((a, b) => a - b),
            );
        }
    });

    it("zeros masked cells and normalizes allowed weights", () => {
        const n = 6;
        const Q = [[1, 0], [0, 1], [1, 1], [0, -1], [1, -1], [0.5, 0.5]];
        const { weights } = bigBirdAttention(Q, Q, Q, 1, 1, 1, 3);
        weights.forEach((row, i) => {
            const allowed = new Set(referenceAllowed(i, n, 1, 1, 1, 3));
            let sum = 0;
            row.forEach((value, j) => {
                if (!allowed.has(j)) {
                    expect(value).toBe(0);
                } else {
                    sum += value;
                }
            });
            expect(sum).toBeCloseTo(1, 9);
        });
    });

    it("matches full attention when globals cover every token", () => {
        const Q = [[1, 0], [0, 1], [1, 1], [0, -1]];
        const expected = fullWeights(Q, Q);
        const got = bigBirdAttention(Q, Q, Q, 4, 0, 0, 1).weights;
        got.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(expected[i]?.[j] ?? 0, 9)));
    });

    it("reproduces the helper output in the final frame and emits well-formed frames", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = bigBirdAttention(input.queries, input.keys, input.values, input.globalTokens, input.window, input.randomTokens, input.seed).output;
        const flat = expected.reduce<number[]>((acc, row) => acc.concat(row), []);
        const metaOutput = frames[frames.length - 1]?.meta["output"] as number[];
        expect(metaOutput).toHaveLength(flat.length);
        flat.forEach((v, i) => expect(metaOutput[i] ?? 0).toBeCloseTo(v, 6));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
