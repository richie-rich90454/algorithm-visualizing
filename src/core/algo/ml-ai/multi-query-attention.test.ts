/**
 * multi-query-attention.test.ts - Shared KV check, attention recomputation,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./multi-query-attention";
import type { VisualFrame } from "@/types";

interface Weights {
    Wq: number[][][];
    Wk: number[][];
    Wv: number[][];
    Wo: number[][];
}

function softmax(row: number[]): number[] {
    const max = Math.max(...row);
    const exps = row.map((value) => Math.exp(value - max));
    const total = exps.reduce((a, b) => a + b, 0);
    return exps.map((value) => value / total);
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => typeof e.metadata["row"] === "number")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Multi-Query Attention", () => {
    it("uses one shared key/value head and reproduces every attention map", () => {
        const input = mod.defaultInput as {
            tokens: number[][];
            heads: number;
            dk: number;
            seed: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.tokens.length);

        const weights = JSON.parse(String(frames[0]?.meta["weights"])) as Weights;
        const n = input.tokens.length;
        const dk = input.dk;
        const scale = Math.sqrt(dk);
        const project = (W: number[][]): number[][] =>
            input.tokens.map((token) =>
                Array.from({ length: dk }, (_v, k) =>
                    token.reduce((sum, x, d) => sum + x * (W[d]?.[k] ?? 0), 0),
                ),
            );
        const K = project(weights.Wk);
        const V = project(weights.Wv);
        const flatK = K.reduce<number[]>((acc, row) => acc.concat(row), []);
        const flatV = V.reduce<number[]>((acc, row) => acc.concat(row), []);

        for (let h = 0; h < input.heads; h += 1) {
            const frame = frames[h + 1];
            expect(frame?.meta["head"]).toBe(h);
            expect(frame?.meta["k"]).toEqual(flatK);
            expect(frame?.meta["v"]).toEqual(flatV);

            const Q = project(weights.Wq[h] ?? []);
            expect(frame?.meta["q"]).toEqual(
                Q.reduce<number[]>((acc, row) => acc.concat(row), []),
            );
            const expected = Q.map((q) =>
                softmax(
                    Array.from({ length: n }, (_v, j) =>
                        q.reduce((sum, value, k) => sum + value * (K[j]?.[k] ?? 0), 0) / scale,
                    ),
                ),
            );
            const actual = frame?.meta["attention"] as number[];
            expected.forEach((row, i) => {
                row.forEach((value, j) => {
                    expect(actual[i * n + j]).toBeCloseTo(value, 8);
                });
                expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
            });
        }

        const final = frames[frames.length - 1]?.meta;
        expect(final?.["kvCacheEntries"]).toBe(n * dk);
        expect(final?.["naiveKvCacheEntries"]).toBe(input.heads * n * dk);
    });

    it("reproduces the output projection and shrinks the cache as heads grow", () => {
        for (const heads of [1, 2, 3]) {
            const frames = [...mod.run({ heads, dk: 2, seed: 7 })];
            checkFrames(frames, 3);
            expect(frames.length).toBe(heads + 2);
            const weights = JSON.parse(String(frames[0]?.meta["weights"])) as Weights;
            const final = frames[frames.length - 1]?.meta;
            const output = final?.["output"] as number[];
            expect(output.length).toBe(3 * 2);
            expect(final?.["kvCacheEntries"]).toBe(3 * 2);
            expect(final?.["naiveKvCacheEntries"]).toBe(heads * 3 * 2);

            const n = 3;
            const dk = 2;
            const concat: number[][] = Array.from({ length: n }, () => Array(heads * dk).fill(0));
            for (let h = 0; h < heads; h += 1) {
                const attention = frames[h + 1]?.meta["attention"] as number[];
                const Q = (frames[h + 1]?.meta["q"] as number[]).slice();
                const V = frames[h + 1]?.meta["v"] as number[];
                for (let i = 0; i < n; i += 1) {
                    for (let k = 0; k < dk; k += 1) {
                        let value = 0;
                        for (let j = 0; j < n; j += 1) {
                            value += (attention[i * n + j] ?? 0) * (V[j * dk + k] ?? 0);
                        }
                        concat[i][h * dk + k] = value;
                    }
                }
                expect(Q.length).toBe(n * dk);
                expect(weights.Wq[h]?.length).toBe(2);
            }
            for (let i = 0; i < n; i += 1) {
                for (let o = 0; o < 2; o += 1) {
                    let value = 0;
                    for (let p = 0; p < heads * dk; p += 1) {
                        value += (concat[i][p] ?? 0) * (weights.Wo[p]?.[o] ?? 0);
                    }
                    expect(output[i * 2 + o]).toBeCloseTo(value, 8);
                }
            }
        }
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
