/**
 * prefix-tuning.test.ts - Frozen-attention recomputation, prefix influence,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { prefixAttention } from "./prefix-tuning";
import type { VisualFrame } from "@/types";

function softmax(row: number[]): number[] {
    const max = Math.max(...row);
    const exps = row.map((value) => Math.exp(value - max));
    const total = exps.reduce((a, b) => a + b, 0);
    return exps.map((value) => value / total);
}

function checkFrames(frames: VisualFrame[], n: number, cols: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Prefix Tuning", () => {
    it("reproduces a brute-force attention pass over the prepended prefix", () => {
        const input = mod.defaultInput as { tokens: number[][]; prefix: number[][] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.tokens.length, input.tokens.length + input.prefix.length);

        const n = input.tokens.length;
        const p = input.prefix.length;
        const keys = [...input.prefix, ...input.tokens];
        const d = input.tokens[0]?.length ?? 1;
        const scale = Math.sqrt(d);
        const expectedWeights: number[][] = [];
        const expectedOutput: number[][] = [];
        for (let i = 0; i < n; i += 1) {
            const scores = keys.map((key) =>
                (input.tokens[i] ?? []).reduce(
                    (sum, x, k) => sum + x * (key[k] ?? 0),
                    0,
                ) / scale,
            );
            const w = softmax(scores);
            expectedWeights.push(w);
            expectedOutput.push(
                Array.from({ length: d }, (_v, k) =>
                    w.reduce((sum, weight, j) => sum + weight * (keys[j]?.[k] ?? 0), 0),
                ),
            );
        }

        const final = frames[frames.length - 1]?.meta;
        const actualAttention = final?.["attention"] as number[];
        const actualOutput = final?.["output"] as number[];
        expectedWeights.forEach((row, i) => {
            row.forEach((value, j) => {
                expect(actualAttention[i * row.length + j]).toBeCloseTo(value, 8);
            });
            expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
        });
        expectedOutput.forEach((row, i) => {
            row.forEach((value, k) => expect(actualOutput[i * row.length + k]).toBeCloseTo(value, 8));
        });
        expect(final?.["trainableVectors"]).toBe(p);
        expect(final?.["frozenVectors"]).toBe(n);

        const direct = prefixAttention(input.tokens, input.prefix);
        expect(direct.cols).toBe(n + p);
        expect(direct.output).toEqual(expectedOutput);
    });

    it("changes every output when a trainable prefix vector changes", () => {
        const tokens = [
            [1, 0],
            [0, 1],
            [1, 1],
        ];
        const prefixA = [
            [0.5, 0.2],
            [-0.1, 0.4],
        ];
        const prefixB = [
            [2.5, -1.3],
            [-0.1, 0.4],
        ];
        const a = prefixAttention(tokens, prefixA).output;
        const b = prefixAttention(tokens, prefixB).output;
        let changed = 0;
        for (let i = 0; i < a.length; i += 1) {
            for (let k = 0; k < (a[i]?.length ?? 0); k += 1) {
                if (Math.abs((a[i]?.[k] ?? 0) - (b[i]?.[k] ?? 0)) > 1e-3) {
                    changed += 1;
                }
            }
        }
        expect(changed).toBeGreaterThan(0);

        const framesA = [...mod.run({ tokens, prefix: prefixA })];
        const framesB = [...mod.run({ tokens, prefix: prefixB })];
        expect(framesA[framesA.length - 1]?.meta["output"]).not.toEqual(
            framesB[framesB.length - 1]?.meta["output"],
        );
        checkFrames(framesB, tokens.length, tokens.length + prefixB.length);
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
