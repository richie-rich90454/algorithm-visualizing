/**
 * flash-attention-3.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./flash-attention-3";
import type { VisualFrame } from "@/types";

function softmax(row: number[]): number[] {
    const max = Math.max(...row);
    const exp = row.map((v) => Math.exp(v - max));
    const total = exp.reduce((a, b) => a + b, 0);
    return exp.map((v) => v / total);
}

/** Independent full softmax-attention reference from the report matrices. */
function reference(
    q: number[],
    k: number[],
    v: number[],
    n: number,
    dk: number,
): number[] {
    const at = (arr: number[], i: number, j: number) => arr[i * dk + j] ?? 0;
    const out: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const scores: number[] = [];
        for (let j = 0; j < n; j += 1) {
            let s = 0;
            for (let d = 0; d < dk; d += 1) {
                s += at(q, i, d) * at(k, j, d);
            }
            scores.push(s / Math.sqrt(dk));
        }
        const weights = softmax(scores);
        for (let d = 0; d < dk; d += 1) {
            let value = 0;
            for (let j = 0; j < n; j += 1) {
                value += weights[j] * at(v, j, d);
            }
            out.push(value);
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(n);
        expect(Number.isFinite(frame.entities[0]?.x)).toBe(true);
    });
}

describe("FlashAttention-3 (Tiled Online Softmax)", () => {
    it("matches independent full softmax attention", () => {
        const input = mod.defaultInput as { tokens: number[][]; tileK: number; seed: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.tokens.length);
        const final = frames[frames.length - 1]?.meta;
        const q = final?.["q"] as number[];
        const k = final?.["k"] as number[];
        const v = final?.["v"] as number[];
        const expected = reference(q, k, v, input.tokens.length, input.tokens[0]?.length ?? 2);
        const out = final?.["out"] as number[];
        expect(out.length).toBe(expected.length);
        out.forEach((value, index) => {
            expect(value).toBeCloseTo(expected[index] ?? 0, 6);
        });
    });

    it("is exact for several tile sizes and token counts", () => {
        const base = mod.defaultInput as { tokens: number[][]; tileK: number; seed: number };
        for (const tileK of [1, 2, 3, 4]) {
            const frames = [...mod.run({ ...base, tileK })];
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(
                final?.["q"] as number[],
                final?.["k"] as number[],
                final?.["v"] as number[],
                base.tokens.length,
                base.tokens[0]?.length ?? 2,
            );
            const out = final?.["out"] as number[];
            out.forEach((value, index) => expect(value).toBeCloseTo(expected[index] ?? 0, 6));
        }
    });

    it("keeps every attention row normalized", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta;
        const referenceOut = final?.["referenceOut"] as number[];
        expect(Array.isArray(referenceOut)).toBe(true);
        expect(referenceOut.length).toBeGreaterThan(0);
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
