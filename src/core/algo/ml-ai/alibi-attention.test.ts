/**
 * alibi-attention.test.ts - Brute-force ALiBi recomputation, causal masking,
 * slope monotonicity, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./alibi-attention";
import type { VisualFrame } from "@/types";

function softmaxPrefix(scores: number[], allowed: number): number[] {
    const prefix = scores.slice(0, allowed);
    const max = Math.max(...prefix);
    const exps = prefix.map((value) => Math.exp(value - max));
    const total = exps.reduce((a, b) => a + b, 0);
    return scores.map((_value, j) => (j < allowed ? (exps[j] ?? 0) / total : 0));
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("ALiBi Attention", () => {
    it("reproduces every head with causal masking and linear distance bias", () => {
        const input = mod.defaultInput as { tokens: number[][]; heads: number };
        const frames = [...mod.run(input)];
        const n = input.tokens.length;
        const d = input.tokens[0]?.length ?? 2;
        checkFrames(frames, n);

        for (let h = 0; h < input.heads; h += 1) {
            const frame = frames[h + 1];
            const slope = Math.pow(2, -(h + 1));
            expect(frame?.meta["slope"]).toBeCloseTo(slope, 12);
            const expected: number[][] = [];
            const expectedOutput: number[][] = [];
            for (let i = 0; i < n; i += 1) {
                const scores = Array.from({ length: n }, (_v, j) => {
                    if (j > i) {
                        return Number.NEGATIVE_INFINITY;
                    }
                    const dot = (input.tokens[i] ?? []).reduce(
                        (sum, x, k) => sum + x * (input.tokens[j]?.[k] ?? 0),
                        0,
                    );
                    return dot / Math.sqrt(d) - slope * (i - j);
                });
                const row = softmaxPrefix(scores, i + 1);
                expected.push(row);
                expectedOutput.push(
                    Array.from({ length: d }, (_v, k) =>
                        row.reduce((sum, weight, j) => sum + weight * (input.tokens[j]?.[k] ?? 0), 0),
                    ),
                );
            }

            const actual = frame?.meta["attention"] as number[];
            const output = frame?.meta["output"] as number[];
            for (let i = 0; i < n; i += 1) {
                for (let j = 0; j < n; j += 1) {
                    expect(actual[i * n + j]).toBeCloseTo(expected[i]?.[j] ?? 0, 8);
                    if (j > i) {
                        expect(expected[i]?.[j]).toBe(0);
                    }
                }
                expect((expected[i] ?? []).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
                for (let k = 0; k < d; k += 1) {
                    expect(output[i * d + k]).toBeCloseTo(expectedOutput[i]?.[k] ?? 0, 8);
                }
            }
        }
    });

    it("gives a steeper slope more attention to the current token", () => {
        const tokens = [
            [1, 0],
            [0, 1],
            [1, 1],
            [0.5, 0.5],
        ];
        const frames = [...mod.run({ tokens, heads: 3 })];
        const n = 4;
        const diagonals: number[][] = [];
        for (let h = 0; h < 3; h += 1) {
            const attention = frames[h + 1]?.meta["attention"] as number[];
            diagonals.push(
                Array.from({ length: n }, (_v, i) => attention[i * n + i] ?? 0),
            );
        }
        for (let i = 0; i < n; i += 1) {
            expect(diagonals[0]?.[i] ?? 0).toBeGreaterThanOrEqual((diagonals[1]?.[i] ?? 0) - 1e-9);
            expect(diagonals[1]?.[i] ?? 0).toBeGreaterThanOrEqual((diagonals[2]?.[i] ?? 0) - 1e-9);
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
