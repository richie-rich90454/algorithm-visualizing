/**
 * nystromformer.test.ts - Matrix inverse, exact landmark reduction, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { invertMatrix, nystromAttention } from "./nystromformer";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
type Input = { queries: Matrix; keys: Matrix; values: Matrix; numLandmarks: number; ridge: number };

const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);

function fullAttention(Q: Matrix, K: Matrix): Matrix {
    const scale = Math.sqrt(K[0]?.length ?? 1);
    return Q.map((query) => {
        const raw = K.map((key) => dot(query, key) / scale);
        const max = Math.max(...raw);
        const exps = raw.map((v) => Math.exp(v - max));
        const total = exps.reduce((a, b) => a + b, 0);
        return exps.map((v) => v / total);
    });
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

describe("Nystromformer", () => {
    it("inverts a matrix so that A times inverse(A) is the identity", () => {
        const A = [[4, 1], [2, 3]];
        const inv = invertMatrix(A, 0);
        for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 2; j += 1) {
                const value = A[i]!.reduce((sum, v, k) => sum + v * (inv[k]?.[j] ?? 0), 0);
                expect(value).toBeCloseTo(i === j ? 1 : 0, 9);
            }
        }
    });

    it("reproduces full softmax attention when every token is a landmark", () => {
        const Q = [[1, 0], [0, 1], [1, 1], [0, -1]];
        const K = [[1, 0], [0, 1], [1, 1], [0, -1]];
        const V = [[2, 0], [0, 3], [1, 1], [-1, 2]];
        const exact = fullAttention(Q, K);
        const result = nystromAttention(Q, K, V, 4, 1e-10);
        result.approx.forEach((row, i) =>
            row.forEach((v, j) => expect(v).toBeCloseTo(exact[i]?.[j] ?? 0, 5)),
        );
    });

    it("keeps attention rows normalized and reports factors with the right shapes", () => {
        const input = mod.defaultInput as Input;
        const r = nystromAttention(input.queries, input.keys, input.values, input.numLandmarks, input.ridge);
        expect(r.landmarks).toEqual([0, 1]);
        expect(r.Ahat).toHaveLength(2);
        expect(r.Bhat).toHaveLength(r.n);
        expect(r.Chat).toHaveLength(2);
        expect(r.output).toHaveLength(r.n);
        for (const row of r.Bhat) {
            expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        }
    });

    it("reproduces the helper output in the final frame and emits well-formed frames", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = nystromAttention(input.queries, input.keys, input.values, input.numLandmarks, input.ridge).output;
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
