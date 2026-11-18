/**
 * grouped-query-attention.test.ts - Independent attention recomputation,
 * shared-head mapping, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./grouped-query-attention";
import type { VisualFrame } from "@/types";

/** Reproduce the module's seeded weight stream independently. */
function weightStream(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return Math.round(((state / 4294967296) * 2 - 1) * 100) / 100;
    };
}

interface Weights { Wq: number[][][]; Wk: number[][][]; Wv: number[][][] }

/** Brute-force recompute one head's attention map from the published weights. */
function referenceHead(tokens: number[][], H: number, G: number, dk: number, seed: number, h: number) {
    const dModel = tokens[0]?.length ?? 2;
    const next = weightStream(seed);
    const Wk: number[][][] = [];
    const Wv: number[][][] = [];
    const Wq: number[][][] = [];
    for (let g = 0; g < G; g += 1) {
        Wk.push(Array.from({ length: dModel }, () => Array.from({ length: dk }, next)));
        Wv.push(Array.from({ length: dModel }, () => Array.from({ length: dk }, next)));
    }
    for (let i = 0; i < H; i += 1) {
        Wq.push(Array.from({ length: dModel }, () => Array.from({ length: dk }, next)));
    }
    const proj = (w: number[][]): number[][] =>
        tokens.map((row) => Array.from({ length: dk }, (_v, k) => row.reduce((s, x, d) => s + x * (w[d]?.[k] ?? 0), 0)));
    const g = Math.floor((h * G) / H);
    const q = proj(Wq[h] ?? []);
    const k = proj(Wk[g] ?? []);
    const v = proj(Wv[g] ?? []);
    const scale = Math.sqrt(dk);
    const scores = q.map((row) => k.map((key) => row.reduce((s, qv, idx) => s + qv * (key[idx] ?? 0), 0) / scale));
    const attention = scores.map((row) => {
        const max = Math.max(...row);
        const exp = row.map((s) => Math.exp(s - max));
        const denom = exp.reduce((a, b) => a + b, 0);
        return exp.map((e) => e / denom);
    });
    return { g, attention };
}

function checkFrames(frames: VisualFrame[], n: number, H: number): void {
    expect(frames.length).toBe(H + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(n);
    });
}

describe("GroupedQueryAttention", () => {
    const tokens = [
        [1, 0],
        [0, 1],
        [1, 1],
    ];

    it("matches brute-force attention and the shared-head mapping for every query head", () => {
        const H = 4;
        const G = 2;
        const dk = 2;
        const seed = 11;
        const frames = [...mod.run({ tokens, qHeads: H, kvHeads: G, dk, seed })];
        checkFrames(frames, tokens.length, H);
        for (let h = 0; h < H; h += 1) {
            const frame = frames[h + 1];
            const expected = referenceHead(tokens, H, G, dk, seed, h);
            expect(frame?.meta["head"]).toBe(h);
            expect(frame?.meta["kvHead"]).toBe(expected.g);
            expect(frame?.meta["kvHead"]).toBe(Math.floor((h * G) / H));
            const got = frame?.meta["attention"] as number[];
            expected.attention.flat().forEach((value, idx) => {
                expect(got[idx]).toBeCloseTo(value, 9);
            });
            const sums = frame?.meta["rowSums"] as number[];
            sums.forEach((s) => expect(s).toBeCloseTo(1, 9));
        }
    });

    it("reduces to multi-head attention when G equals H and multi-query when G equals 1", () => {
        for (const G of [1, 4]) {
            const frames = [...mod.run({ tokens, qHeads: 4, kvHeads: G, dk: 2, seed: 7 })];
            checkFrames(frames, tokens.length, 4);
            for (let h = 0; h < 4; h += 1) {
                const expected = referenceHead(tokens, 4, G, 2, 7, h);
                const got = frames[h + 1]?.meta["attention"] as number[];
                expected.attention.flat().forEach((value, idx) => {
                    expect(got[idx]).toBeCloseTo(value, 9);
                });
            }
        }
        const single = [...mod.run({ tokens, qHeads: 4, kvHeads: 1, dk: 2, seed: 7 })];
        for (const frame of single.slice(1, 5)) {
            expect(frame.meta["kvHead"]).toBe(0);
        }
    });

    it("reads weights from metadata and reproduces the last head output exactly", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const last = frames[frames.length - 1];
        const weights = JSON.parse(String(last?.meta["weights"])) as Weights;
        expect(weights.Wq.length).toBe(4);
        expect(weights.Wk.length).toBe(2);
        expect(weights.Wv.length).toBe(2);
        const H = 4;
        const G = 2;
        const dk = 2;
        const tokensIn = (mod.defaultInput as { tokens: number[][] }).tokens;
        const expected = referenceHead(tokensIn, H, G, dk, 11, 3);
        const got = last?.meta["attention"] as number[];
        expected.attention.flat().forEach((value, idx) => expect(got[idx]).toBeCloseTo(value, 9));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
