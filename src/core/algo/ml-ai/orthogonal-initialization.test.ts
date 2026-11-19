/** orthogonal-initialization.test.ts - Orthonormality property and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./orthogonal-initialization";
import type { VisualFrame } from "@/types";

interface Input {
    rows: number;
    cols: number;
    gain: number;
}

function reference(rows: number, cols: number) {
    const q: number[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    for (let j = 0; j < cols; j += 1) {
        const col = Array.from({ length: rows }, (_u, i) => Math.cos((i + 1) * 0.7 + (j + 1) * 1.3) + (i === j ? 3 : 0));
        for (let k = 0; k < j; k += 1) {
            let coef = 0;
            for (let i = 0; i < rows; i += 1) coef += (q[i]?.[k] ?? 0) * (col[i] ?? 0);
            for (let i = 0; i < rows; i += 1) col[i] = (col[i] ?? 0) - coef * (q[i]?.[k] ?? 0);
        }
        const len = Math.sqrt(col.reduce((s, v) => s + v * v, 0));
        for (let i = 0; i < rows; i += 1) q[i]![j] = (col[i] ?? 0) / len;
    }
    return q;
}

function gramError(q: number[][], gain: number): number {
    const cols = q[0]?.length ?? 0;
    let worst = 0;
    for (let a = 0; a < cols; a += 1) {
        for (let b = 0; b < cols; b += 1) {
            let prod = 0;
            for (let i = 0; i < q.length; i += 1) prod += (q[i]?.[a] ?? 0) * (q[i]?.[b] ?? 0);
            worst = Math.max(worst, Math.abs(prod - (a === b ? gain * gain : 0)));
        }
    }
    return worst;
}

function checkFrames(frames: VisualFrame[], input: Input): void {
    expect(frames.length).toBe(input.cols + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(input.rows * input.cols);
        expect(frame.entities.every((e) => e.id.length > 0 && Number.isFinite(e.value as number))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Orthogonal initialization", () => {
    const input = mod.defaultInput as Input;

    it("produces an orthonormal matrix matching an independent Gram-Schmidt", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input);
        const expected = reference(input.rows, input.cols);
        const final = frames[frames.length - 1]?.meta;
        const matrix = final?.["matrix"] as number[];
        expect(matrix.length).toBe(input.rows * input.cols);
        matrix.forEach((value, idx) => {
            const i = Math.floor(idx / input.cols);
            const j = idx % input.cols;
            expect(value).toBeCloseTo(expected[i]?.[j] ?? 0, 8);
        });
        expect(gramError(expected, input.gain)).toBeLessThan(1e-9);
        expect(Number(final?.["error"])).toBeLessThan(1e-9);
    });

    it("respects the gain and column cap", () => {
        const frames = [...mod.run({ rows: 4, cols: 2, gain: 1.5 })];
        const final = frames[frames.length - 1]?.meta;
        const flat = final?.["matrix"] as number[];
        const grid = Array.from({ length: 4 }, (_u, i) =>
            Array.from({ length: 2 }, (_v, j) => flat[i * 2 + j] ?? 0),
        );
        expect(gramError(grid, 1.5)).toBeLessThan(1e-9);
        expect(final?.["cols"]).toBe(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
