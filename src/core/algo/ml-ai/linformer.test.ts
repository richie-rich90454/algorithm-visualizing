/**
 * linformer.test.ts - Low-rank projection correctness, identity reduction, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { linformerAttention } from "./linformer";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
type Input = { queries: Matrix; keys: Matrix; values: Matrix; projKeys: Matrix; projValues: Matrix };

const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);

function fullAttention(Q: Matrix, K: Matrix, V: Matrix): Matrix {
    const scale = Math.sqrt(K[0]?.length ?? 1);
    const dv = V[0]?.length ?? 0;
    return Q.map((query) => {
        const raw = K.map((key) => dot(query, key) / scale);
        const max = Math.max(...raw);
        const exps = raw.map((v) => Math.exp(v - max));
        const total = exps.reduce((a, b) => a + b, 0);
        return Array.from({ length: dv }, (_, c) =>
            V.reduce((sum, value, j) => sum + ((exps[j] ?? 0) / total) * (value[c] ?? 0), 0),
        );
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

describe("Linformer", () => {
    it("matches full attention when k equals n with identity projections", () => {
        const Q = [[1, 0], [0, 1], [1, 1], [0, -1]];
        const K = [[1, 0], [0, 1], [1, 1], [0, -1]];
        const V = [[2, 0], [0, 3], [1, 1], [-1, 2]];
        const I = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
        const got = linformerAttention(Q, K, V, I, I).output;
        const expected = fullAttention(Q, K, V);
        got.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(expected[i]?.[j] ?? 0, 9)));
    });

    it("produces k projected rows and rows of attention summing to one", () => {
        const input = mod.defaultInput as Input;
        const result = linformerAttention(input.queries, input.keys, input.values, input.projKeys, input.projValues);
        expect(result.projectedKeys).toHaveLength(result.k);
        expect(result.projectedValues).toHaveLength(result.k);
        expect(result.output).toHaveLength(input.queries.length);
        for (const row of result.weights) {
            expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        }
    });

    it("reproduces the helper output in the final frame and emits well-formed frames", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = linformerAttention(input.queries, input.keys, input.values, input.projKeys, input.projValues).output;
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
