/**
 * multi-latent-attention.test.ts - Latent compression correctness, brute-force attention, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { latentAttention } from "./multi-latent-attention";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
type Input = { tokens: Matrix; queries: Matrix; down: Matrix; upKeys: Matrix; upValues: Matrix };

const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);

/** Independent reference that reconstructs keys and values before attending. */
function reference(tokens: Matrix, queries: Matrix, down: Matrix, upKeys: Matrix, upValues: Matrix): Matrix {
    const latent = tokens.map((token) =>
        Array.from({ length: down[0]?.length ?? 0 }, (_, j) =>
            down.reduce((sum, row, i) => sum + (token[i] ?? 0) * (row[j] ?? 0), 0),
        ),
    );
    const keys = latent.map((code) => upKeys.map((col) => dot(code, col)));
    const values = latent.map((code) => upValues.map((col) => dot(code, col)));
    const scale = Math.sqrt(keys[0]?.length ?? 1);
    const dv = values[0]?.length ?? 0;
    return queries.map((query) => {
        const raw = keys.map((key) => dot(query, key) / scale);
        const max = Math.max(...raw);
        const exps = raw.map((v) => Math.exp(v - max));
        const total = exps.reduce((a, b) => a + b, 0);
        return Array.from({ length: dv }, (_, c) =>
            values.reduce((sum, value, j) => sum + ((exps[j] ?? 0) / total) * (value[c] ?? 0), 0),
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

describe("Multi-Head Latent Attention", () => {
    it("matches an independent latent-attention reference on several inputs", () => {
        const cases: Input[] = [
            {
                tokens: [[1, 0], [0, 1], [1, 1], [0, -1]],
                queries: [[1, 0], [0, 1], [1, 1], [0, -1]],
                down: [[1], [1]],
                upKeys: [[1], [0]],
                upValues: [[0], [1]],
            },
            {
                tokens: [[2, 0, 1], [0, 1, 3], [1, -1, 0]],
                queries: [[1, 1, 0], [0, 1, 1]],
                down: [[1, 0], [0, 1], [1, 1]],
                upKeys: [[1, 0], [0, 1], [1, 0]],
                upValues: [[0, 1], [1, 0], [0, 0]],
            },
        ];
        for (const c of cases) {
            const got = latentAttention(c.tokens, c.queries, c.down, c.upKeys, c.upValues).output;
            const expected = reference(c.tokens, c.queries, c.down, c.upKeys, c.upValues);
            got.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(expected[i]?.[j] ?? 0, 9)));
        }
    });

    it("compresses to width c and normalizes attention rows", () => {
        const input = mod.defaultInput as Input;
        const r = latentAttention(input.tokens, input.queries, input.down, input.upKeys, input.upValues);
        expect(r.c).toBe(1);
        expect(r.latent).toHaveLength(input.tokens.length);
        expect(r.latent[0]).toHaveLength(1);
        expect(r.keys[0]).toHaveLength(r.d);
        for (const row of r.weights) {
            expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        }
    });

    it("reports the helper output in the final frame and emits well-formed frames", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = latentAttention(input.tokens, input.queries, input.down, input.upKeys, input.upValues).output;
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
