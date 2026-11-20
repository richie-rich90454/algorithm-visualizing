/** sliding-window-attention.test.ts - Mask, softmax, output, and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./sliding-window-attention";
import type { VisualFrame } from "@/types";

interface Input {
    queries: number[][];
    keys: number[][];
    values: number[][];
    window: number;
}

/** Independent brute-force computation of windowed causal attention. */
function reference(Q: number[][], K: number[][], V: number[][], w: number) {
    const scale = Math.sqrt(K[0]?.length ?? 1);
    const weights: number[][] = [];
    const output: number[][] = [];
    for (let i = 0; i < Q.length; i += 1) {
        const lo = Math.max(0, i - w + 1);
        const scores: number[] = [];
        const js: number[] = [];
        for (let j = lo; j <= i && j < K.length; j += 1) {
            let dot = 0;
            for (let k = 0; k < (Q[i]?.length ?? 0); k += 1) {
                dot += (Q[i]?.[k] ?? 0) * (K[j]?.[k] ?? 0);
            }
            scores.push(dot / scale);
            js.push(j);
        }
        const max = Math.max(...scores);
        const exps = scores.map((s) => Math.exp(s - max));
        const total = exps.reduce((a, b) => a + b, 0);
        const row = Array(K.length).fill(0) as number[];
        js.forEach((j, idx) => {
            row[j] = (exps[idx] ?? 0) / total;
        });
        const outRow: number[] = [];
        for (let k = 0; k < (V[0]?.length ?? 0); k += 1) {
            let v = 0;
            for (let j = 0; j < V.length; j += 1) {
                v += (row[j] ?? 0) * (V[j]?.[k] ?? 0);
            }
            outRow.push(v);
        }
        weights.push(row);
        output.push(outRow);
    }
    return { weights, output };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        const rows = Number(frame.meta["rows"]);
        const cols = Number(frame.meta["cols"]);
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Sliding Window Attention", () => {
    it("matches a brute-force masked attention calculation", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const gotW = final?.["weights"] as number[];
        const gotO = final?.["output"] as number[];
        const expected = reference(input.queries, input.keys, input.values, input.window);
        const n = input.queries.length;
        expected.weights.forEach((row, i) => {
            row.forEach((weight, j) => {
                expect(gotW[i * n + j]).toBeCloseTo(weight, 9);
            });
        });
        expected.output.forEach((row, i) => {
            row.forEach((value, k) => {
                expect(gotO[i * row.length + k]).toBeCloseTo(value, 9);
            });
        });
    });

    it("masks outside the window and keeps each row stochastic", () => {
        for (const w of [1, 2, 3, 5]) {
            const input = { ...(mod.defaultInput as Input), window: w };
            const frames = [...mod.run(input)];
            const weights = frames[frames.length - 1]?.meta["weights"] as number[];
            const n = input.queries.length;
            for (let i = 0; i < n; i += 1) {
                let sum = 0;
                for (let j = 0; j < n; j += 1) {
                    const value = weights[i * n + j] ?? 0;
                    if (j < i - w + 1 || j > i) {
                        expect(value).toBe(0);
                    } else {
                        sum += value;
                    }
                }
                expect(sum).toBeCloseTo(1, 9);
            }
        }
    });

    it("with window one returns each value unchanged", () => {
        const input = { ...(mod.defaultInput as Input), window: 1 };
        const frames = [...mod.run(input)];
        const out = frames[frames.length - 1]?.meta["output"] as number[];
        const d = input.values[0]?.length ?? 0;
        input.values.forEach((row, i) => {
            row.forEach((value, k) => {
                expect(out[i * d + k]).toBeCloseTo(value, 9);
            });
        });
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
