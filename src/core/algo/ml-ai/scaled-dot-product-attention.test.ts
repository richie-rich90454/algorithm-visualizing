/**
 * scaled-dot-product-attention.test.ts - Brute-force attention, row sums, frame shape.
 */

import { describe, expect, it } from "vitest";
import mod, { attention } from "./scaled-dot-product-attention";
import type { VisualFrame } from "@/types";

interface Input {
    queries: number[][];
    keys: number[][];
    values: number[][];
}

/** Independent, loop-based reference for attention. */
function reference(input: Input) {
    const d = input.keys[0]?.length ?? 1;
    const scale = Math.sqrt(d);
    const scores: number[][] = [];
    const weights: number[][] = [];
    const output: number[][] = [];
    for (const query of input.queries) {
        const row: number[] = [];
        for (const key of input.keys) {
            let dot = 0;
            for (let k = 0; k < d; k += 1) {
                dot += (query[k] ?? 0) * (key[k] ?? 0);
            }
            row.push(dot / scale);
        }
        const max = Math.max(...row);
        const exps = row.map((value) => Math.exp(value - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        const w = exps.map((value) => value / sum);
        scores.push(row);
        weights.push(w);
        const out: number[] = [];
        const outDim = input.values[0]?.length ?? 0;
        for (let k = 0; k < outDim; k += 1) {
            let value = 0;
            for (let j = 0; j < input.values.length; j += 1) {
                value += (w[j] ?? 0) * (input.values[j]?.[k] ?? 0);
            }
            out.push(value);
        }
        output.push(out);
    }
    return { scores, weights, output };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.edges).toEqual([]);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.length).toBe(Number(frame.meta["rows"]) * Number(frame.meta["cols"]));
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        for (const entity of frame.entities) {
            expect(entity.metadata["row"]).toBeTypeOf("number");
            expect(entity.metadata["col"]).toBeTypeOf("number");
        }
    });
}

describe("Scaled Dot-Product Attention", () => {
    it("matches a brute-force attention computation", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const output = final?.["output"] as number[];
        const weights = final?.["weights"] as number[];
        expect(output.length).toBe(expected.output.length * (expected.output[0]?.length ?? 0));
        let index = 0;
        for (const row of expected.output) {
            for (const value of row) {
                expect(output[index] ?? 0).toBeCloseTo(value, 10);
                index += 1;
            }
        }
        index = 0;
        for (const row of expected.weights) {
            for (const value of row) {
                expect(weights[index] ?? 0).toBeCloseTo(value, 10);
                index += 1;
            }
        }
    });

    it("produces row-stochastic weights on several shapes", () => {
        const inputs: Input[] = [
            mod.defaultInput as Input,
            {
                queries: [[1, 0, 0], [0, 1, 0]],
                keys: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]],
                values: [[5, 1], [1, 5], [2, 2], [9, 0]],
            },
        ];
        for (const input of inputs) {
            const n = input.queries.length;
            const k = input.keys.length;
            const result = attention(input.queries, input.keys, input.values);
            expect(result.weights.length).toBe(n);
            for (const row of result.weights) {
                expect(row.length).toBe(k);
                expect(row.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
                for (const value of row) {
                    expect(value).toBeGreaterThanOrEqual(0);
                }
            }
            const frames = [...mod.run(input)];
            checkFrames(frames);
            expect(frames[1]?.entities.length).toBe(n * k);
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
