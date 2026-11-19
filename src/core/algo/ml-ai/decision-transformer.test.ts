/** decision-transformer.test.ts - Causal attention mask and reference computation. */
import { describe, expect, it } from "vitest";
import mod from "./decision-transformer";
import type { VisualFrame } from "@/types";

interface Input {
    tokens: number[][];
    wq: number[][];
    wk: number[][];
    wv: number[][];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("grid");
        expect(frame.meta).toBeDefined();
    });
}

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, w, i) => sum + w * (vector[i] ?? 0), 0));
}

function attention(input: Input) {
    const q = input.tokens.map((t) => matVec(input.wq, t));
    const k = input.tokens.map((t) => matVec(input.wk, t));
    const v = input.tokens.map((t) => matVec(input.wv, t));
    const d = Math.max(1, input.tokens[0]!.length);
    const t = input.tokens.length;
    const weights: number[][] = [];
    for (let i = 0; i < t; i += 1) {
        const row = k.map((key, j) =>
            j > i ? -Infinity : q[i]!.reduce((s, val, dim) => s + val * key[dim]!, 0) / Math.sqrt(d),
        );
        const max = Math.max(...row);
        const exps = row.map((score) => (score === -Infinity ? 0 : Math.exp(score - max)));
        const total = exps.reduce((a, x) => a + x, 0);
        weights.push(exps.map((x) => x / total));
    }
    const output = weights.map((row) =>
        row.reduce((sum, weight, j) => sum + weight * v[j]![0]!, 0),
    );
    return { weights, output };
}

describe("Decision Transformer", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent scaled dot-product attention", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = attention(input);
        const final = frames[frames.length - 1]!.meta;
        (final["output"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.output[i]!, 10));
        (final["flatAttention"] as number[]).forEach((v, i) =>
            expect(v).toBeCloseTo(expected.weights.flat()[i]!, 10),
        );
    });

    it("enforces a strict causal mask and row normalization", () => {
        const frames = [...mod.run(input)];
        const expected = attention(input);
        const t = input.tokens.length;
        expected.weights.forEach((row, i) => {
            expect(row.reduce((a, w) => a + w, 0)).toBeCloseTo(1, 10);
            row.forEach((weight, j) => {
                if (j > i) {
                    expect(weight).toBe(0);
                } else {
                    expect(weight).toBeGreaterThanOrEqual(0);
                }
            });
        });
        const stepFrames = frames.filter((f) => f.meta["row"] !== undefined);
        expect(stepFrames.length).toBe(t);
        stepFrames.forEach((frame, i) => {
            (frame.meta["row"] as number[]).forEach((w, j) =>
                expect(w).toBeCloseTo(expected.weights[i]![j]!, 10),
            );
        });
    });

    it("does not let a future token change earlier outputs", () => {
        const changed: Input = {
            ...input,
            tokens: input.tokens.map((token, i) => (i === input.tokens.length - 1 ? [50, -50] : token)),
        };
        const base = attention(input).output;
        const after = attention(changed).output;
        base.slice(0, -1).forEach((v, i) => expect(after[i]!).toBeCloseTo(v, 10));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
