/**
 * t5-model.test.ts - Independent reference correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./t5-model";
import type { VisualFrame } from "@/types";

type Matrix = number[][];

interface T5Input {
    encQ: Matrix;
    encK: Matrix;
    encV: Matrix;
    decQ: Matrix;
    Wk: Matrix;
    Wv: Matrix;
    relBias: number[];
}

function transpose(m: Matrix): Matrix {
    return m[0]?.map((_, col) => m.map((row) => row[col] ?? 0)) ?? [];
}

function multiply(a: Matrix, b: Matrix): Matrix {
    return a.map((row) => b[0]?.map((_, col) => row.reduce((sum, value, k) => sum + value * (b[k]?.[col] ?? 0), 0)) ?? []);
}

function softmaxRow(row: number[]): number[] {
    const max = Math.max(...row);
    const exps = row.map((value) => Math.exp(value - max));
    const total = exps.reduce((a, b) => a + b, 0) || 1;
    return exps.map((value) => value / total);
}

function reference(cfg: T5Input) {
    const d = Math.max(1, cfg.encQ[0]?.length ?? 1);
    const scale = Math.sqrt(d);
    const encoderScores = multiply(cfg.encQ, transpose(cfg.encK)).map((row) => row.map((v) => v / scale));
    const encoderAttention = encoderScores.map(softmaxRow);
    const encoderOutput = multiply(encoderAttention, cfg.encV);
    const crossKeys = multiply(encoderOutput, cfg.Wk);
    const crossValues = multiply(encoderOutput, cfg.Wv);
    const baseScores = multiply(cfg.decQ, transpose(crossKeys)).map((row) => row.map((v) => v / scale));
    const center = Math.floor(cfg.relBias.length / 2);
    const crossScores = baseScores.map((row, queryIndex) =>
        row.map((value, keyIndex) => {
            const bucket = Math.max(0, Math.min(cfg.relBias.length - 1, keyIndex - queryIndex + center));
            return value + (cfg.relBias[bucket] ?? 0);
        }),
    );
    const crossAttention = crossScores.map(softmaxRow);
    const context = multiply(crossAttention, crossValues);
    return { encoderAttention, encoderOutput, crossKeys, crossValues, baseScores, crossScores, crossAttention, context };
}

function expectMatrixClose(actual: unknown, expected: Matrix): void {
    const matrix = actual as Matrix;
    expect(matrix.length).toBe(expected.length);
    for (let row = 0; row < expected.length; row += 1) {
        expect(matrix[row]?.length).toBe(expected[row]?.length);
        for (let col = 0; col < (expected[row]?.length ?? 0); col += 1) {
            expect(matrix[row]?.[col] ?? 0).toBeCloseTo(expected[row]?.[col] ?? 0, 9);
        }
    }
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe(mod.visualType);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Number(frame.meta["rows"])).toBeGreaterThan(0);
        expect(Number(frame.meta["cols"])).toBeGreaterThan(0);
    });
}

const input: T5Input = {
    encQ: [
        [1, 0.5],
        [0, 1],
        [-0.5, 0.5],
    ],
    encK: [
        [1, 1],
        [0, 1],
        [1, -0.5],
    ],
    encV: [
        [1, 2],
        [3, 4],
        [0, 1],
    ],
    decQ: [
        [1, 0],
        [0, 1],
    ],
    Wk: [
        [1, 0.5],
        [0, 1],
    ],
    Wv: [
        [0, 1],
        [1, 0],
    ],
    relBias: [-0.5, 0, 0.5, 0, -0.5],
};

describe("T5 encoder-decoder cross-attention", () => {
    it("matches an independent five-stage matrix reference", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        expectMatrixClose(frames[0]?.meta["values"], expected.encoderAttention);
        expectMatrixClose(frames[1]?.meta["values"], expected.encoderOutput);
        expectMatrixClose(frames[2]?.meta["values"], expected.crossScores);
        expectMatrixClose(frames[2]?.meta["baseScores"], expected.baseScores);
        expectMatrixClose(frames[3]?.meta["values"], expected.crossAttention);
        expectMatrixClose(frames[4]?.meta["values"], expected.context);
    });

    it("keeps attention rows nonnegative and summing to one", () => {
        const frames = [...mod.run(input)];
        for (const frame of [frames[0], frames[3]]) {
            const values = frame?.meta["values"] as Matrix;
            for (const row of values ?? []) {
                expect(row.every((value) => value >= 0)).toBe(true);
                expect(row.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
            }
            const rowSums = frame?.meta["rowSums"] as number[];
            for (const sum of rowSums ?? []) {
                expect(sum).toBeCloseTo(1, 6);
            }
        }
        const crossAttention = frames[3]?.meta["values"] as Matrix;
        for (const row of crossAttention ?? []) {
            expect(row.length).toBe((frames[2]?.meta["values"] as Matrix)[0]?.length);
        }
    });

    it("reports consistent output shapes", () => {
        const frames = [...mod.run(input)];
        const summary = frames[5]?.meta;
        expect(summary?.["encoderShape"]).toEqual([3, 2]);
        expect(summary?.["contextShape"]).toEqual([2, 2]);
        expect(summary?.["crossScoresShape"]).toEqual([2, 3]);
    });

    it("is deterministic for the same matrices", () => {
        const a = [...mod.run(input)][4]?.meta["values"];
        const b = [...mod.run(input)][4]?.meta["values"];
        expect(a).toEqual(b);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
