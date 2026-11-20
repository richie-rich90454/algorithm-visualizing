/** transformer-xl.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod, { transformerXlAttention } from "./transformer-xl";
import type { VisualFrame } from "@/types";

interface Vec { q: number[]; k: number[]; v: number[] }
interface Memory { keys: number[][]; values: number[][] }

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, x, i) => sum + x * (b[i] ?? 0), 0);
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Transformer-XL", () => {
    it("matches an independently recomputed segment attention with memory", () => {
        const input = mod.defaultInput as { current: Vec[]; memory: Memory; relativeBias: number[] };
        const { current, memory, relativeBias } = input;
        const frames = [...mod.run(input)];
        const m = memory.keys.length;
        checkFrames(frames, current.length, m + current.length);

        const result = transformerXlAttention(current, memory, relativeBias);
        const allKeys = [...memory.keys, ...current.map((t) => t.k)];
        const allVals = [...memory.values, ...current.map((t) => t.v)];
        const dim = current[0].q.length;
        current.forEach((token, i) => {
            const scores = allKeys.map((key, j) => {
                const distance = (m + i) - j;
                const relIndex = Math.min(relativeBias.length - 1, Math.max(0, distance));
                return dot(token.q, key) / Math.sqrt(dim) + relativeBias[relIndex];
            });
            const max = Math.max(...scores);
            const exps = scores.map((s) => Math.exp(s - max));
            const sum = exps.reduce((a, b) => a + b, 0);
            const probs = exps.map((e) => e / sum);
            probs.forEach((p, j) => expect(result.weights[i][j]).toBeCloseTo(p, 10));
            expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
            for (let d = 0; d < dim; d += 1) {
                let expected = 0;
                probs.forEach((p, j) => { expected += p * allVals[j][d]; });
                expect(result.outputs[i][d]).toBeCloseTo(expected, 10);
            }
        });
    });

    it("applies relative bias by clamped distance", () => {
        const input = mod.defaultInput as { current: Vec[]; memory: Memory; relativeBias: number[] };
        const result = transformerXlAttention(input.current, input.memory, input.relativeBias);
        const m = input.memory.keys.length;
        result.relativeIndices.forEach((row, i) => {
            row.forEach((rel, j) => {
                const distance = (m + i) - j;
                const expected = Math.min(input.relativeBias.length - 1, Math.max(0, distance));
                expect(rel).toBe(expected);
            });
        });
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
