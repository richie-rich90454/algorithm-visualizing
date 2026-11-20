/** performer.test.ts - Exact softmax reference, feature-count convergence, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { exactAttention, performerAttention } from "./performer";
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

function meanError(a: number[][], b: number[][]): number {
    let total = 0;
    let count = 0;
    a.forEach((row, i) => row.forEach((value, j) => {
        total += Math.abs(value - (b[i]?.[j] ?? 0));
        count += 1;
    }));
    return total / count;
}

describe("Performer", () => {
    const q = [[1, 0], [0, 1], [1, 1], [0.5, 0.5]];

    it("matches exact scaled dot-product softmax attention", () => {
        const k = [[1, 0], [0, 1], [1, 1], [0.5, 0.5]];
        const v = [[1, 2], [3, 4], [5, 6], [7, 8]];
        const got = exactAttention(q, k, v);
        for (let i = 0; i < q.length; i += 1) {
            const scores = k.map((key) => q[i]!.reduce((s, x, d) => s + x * key[d]!, 0) / Math.sqrt(2));
            const max = Math.max(...scores);
            const exps = scores.map((s) => Math.exp(s - max));
            const sum = exps.reduce((a, b) => a + b, 0);
            for (let dim = 0; dim < 2; dim += 1) {
                const expected = v.reduce((s, row, j) => s + (exps[j]! / sum) * row[dim]!, 0);
                expect(got[i]?.[dim]).toBeCloseTo(expected, 10);
            }
        }
    });

    it("is deterministic and improves with more random features", () => {
        const k = q;
        const v = q;
        const exact = exactAttention(q, k, v);
        const a = performerAttention(q, k, v, 256, 7);
        const b = performerAttention(q, k, v, 256, 7);
        a.forEach((row, i) => row.forEach((value, j) => expect(value).toBe(row[j])));
        expect(a).toEqual(b);
        const small = performerAttention(q, k, v, 8, 7);
        const large = performerAttention(q, k, v, 1024, 7);
        expect(meanError(large, exact)).toBeLessThan(meanError(small, exact));
    });

    it("emits well-formed frames consistent with the reference", () => {
        const input = mod.defaultInput as {
            queries: number[][]; keys: number[][]; values: number[][]; features: number; seed: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const exact = exactAttention(input.queries, input.keys, input.values).flat();
        const approx = performerAttention(input.queries, input.keys, input.values, input.features, input.seed).flat();
        (final?.["exact"] as number[]).forEach((value, i) => expect(value).toBeCloseTo(exact[i] ?? 0, 10));
        (final?.["approx"] as number[]).forEach((value, i) => expect(value).toBeCloseTo(approx[i] ?? 0, 10));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
