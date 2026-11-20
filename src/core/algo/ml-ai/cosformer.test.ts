/** cosformer.test.ts - Fast versus pairwise equivalence, positivity, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./cosformer";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface Input {
    queries: Matrix;
    keys: Matrix;
    values: Matrix;
}

function close(a: number, b: number, eps = 1e-9): boolean {
    return Math.abs(a - b) <= eps;
}

function rows(flat: number[], cols: number): Matrix {
    const out: Matrix = [];
    for (let i = 0; i < flat.length; i += cols) out.push(flat.slice(i, i + cols));
    return out;
}

/** Independent explicit pairwise computation of CosFormer attention. */
function reference(input: Input, theta: number): Matrix {
    const feat = (row: number[], pos: number): number[] =>
        row.map((v) => Math.max(0, v) * Math.cos(pos * theta));
    const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
    return input.queries.map((query, i) => {
        const q = feat(query, i);
        const k = input.keys.map((key, j) => feat(key, j));
        const weights = k.map((key) => dot(q, key));
        const den = weights.reduce((a, b) => a + b, 0);
        return Array.from({ length: input.values[0]?.length ?? 0 }, (_, b) => {
            const num = input.values.reduce((s, value, j) => s + (weights[j] ?? 0) * (value[b] ?? 0), 0);
            return den === 0 ? 0 : num / den;
        });
    });
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("CosFormer attention", () => {
    it("matches an explicit pairwise kernel computation on the default input", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const theta = (Math.PI / 2) / input.keys.length;
        const expected = reference(input, theta);
        const final = frames[frames.length - 1]?.meta;
        const cols = input.values[0]?.length ?? 0;
        const actual = rows(final?.["output"] as number[], cols);
        actual.forEach((row, i) => row.forEach((v, j) => expect(close(v, expected[i]![j]!)).toBe(true)));
    });

    it("keeps the feature map nonnegative and the normalizer finite", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const z = frames[frames.length - 1]?.meta["z"] as number[];
        expect(z.every((v) => Number.isFinite(v) && v >= 0)).toBe(true);
        const S = frames[frames.length - 1]?.meta["S"] as number[];
        expect(S.every((v) => Number.isFinite(v))).toBe(true);
    });

    it("matches the reference on a second deterministic input", () => {
        const input: Input = {
            queries: [[0.7, -1], [2, 0.3], [0.1, 1.4]],
            keys: [[1.2, 0.2], [0.5, 1.7], [-0.3, 0.9], [2, 2]],
            values: [[1, 2, 0], [0, -1, 3], [2, 0, 1], [1, 1, 1]],
        };
        const theta = (Math.PI / 2) / input.keys.length;
        const expected = reference(input, theta);
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        const actual = rows(final?.["output"] as number[], 3);
        actual.forEach((row, i) => row.forEach((v, j) => expect(close(v, expected[i]![j]!)).toBe(true)));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
