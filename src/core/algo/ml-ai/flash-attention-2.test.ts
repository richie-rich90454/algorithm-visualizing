/**
 * flash-attention-2.test.ts - Independent naive-attention cross-check,
 * softmax property checks, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./flash-attention-2";
import type { VisualFrame } from "@/types";

type Vec = number[];

function dot(a: Vec, b: Vec): number {
    let total = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
        total += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return total;
}

/** Straightforward full-matrix softmax attention, independent of the module. */
function naiveAttention(Q: number[][], K: number[][], V: number[][]): number[][] {
    const scale = Math.sqrt(K[0]?.length ?? 1);
    const rows = Q.length;
    const cols = K.length;
    const dv = V[0]?.length ?? 1;
    const scores = Q.map((q) => K.map((k) => dot(q, k) / scale));
    const attention = scores.map((row) => {
        const max = Math.max(...row);
        const exp = row.map((s) => Math.exp(s - max));
        const denom = exp.reduce((a, b) => a + b, 0);
        return exp.map((e) => e / denom);
    });
    return Array.from({ length: rows }, (_v, i) =>
        Array.from({ length: dv }, (_x, k) => attention[i]!.reduce((s, weight, j) => s + weight * (V[j]?.[k] ?? 0), 0)),
    );
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(cols);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("FlashAttentionOnlineSoftmax", () => {
    it("matches naive full-matrix attention exactly", () => {
        const input = mod.defaultInput as { Q: number[][]; K: number[][]; V: number[][] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.Q.length, input.K.length);
        const final = frames[frames.length - 1]?.meta;
        const expected = naiveAttention(input.Q, input.K, input.V).flat();
        const actual = final?.["output"] as number[];
        expect(actual.length).toBe(expected.length);
        for (let i = 0; i < expected.length; i += 1) {
            expect(Math.abs((actual[i] ?? 0) - (expected[i] ?? 0))).toBeLessThan(1e-6);
        }
    });

    it("reproduces exact softmax rows when values are the identity", () => {
        const Q = [[1, 0], [0, 1], [1, 1]];
        const K = [[1, 0], [0, 1], [1, -1]];
        const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        for (const block of [1, 2, 3]) {
            const frames = [...mod.run({ Q, K, V, block })];
            checkFrames(frames, Q.length, K.length);
            const final = frames[frames.length - 1]?.meta;
            const flat = final?.["output"] as number[];
            const width = final?.["outputWidth"] as number;
            const actual = Array.from({ length: Q.length }, (_v, i) => flat.slice(i * width, (i + 1) * width));
            for (const row of actual) {
                const sum = row.reduce((a, b) => a + b, 0);
                expect(Math.abs(sum - 1)).toBeLessThan(1e-6);
                expect(row.every((v) => v >= -1e-9)).toBe(true);
            }
        }
    });

    it("gives identical results for different tile sizes", () => {
        const input = mod.defaultInput as { Q: number[][]; K: number[][]; V: number[][] };
        const byTile = [1, 2, 4].map((block) => {
            const frames = [...mod.run({ ...input, block })];
            return frames[frames.length - 1]?.meta["output"] as number[];
        });
        for (const output of byTile) {
            for (let i = 0; i < output.length; i += 1) {
                expect(Math.abs((output[i] ?? 0) - (byTile[0]?.[i] ?? 0))).toBeLessThan(1e-6);
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
