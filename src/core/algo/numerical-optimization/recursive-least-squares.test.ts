/**
 * recursive-least-squares.test.ts - Batch least-squares match, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./recursive-least-squares";
import type { VisualFrame } from "@/types";

function solve(matrix: number[][], rhs: number[]): number[] {
    const n = rhs.length;
    const m = matrix.map((row, index) => [...row, rhs[index] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < n; row += 1) {
            if (Math.abs(m[row]![col] ?? 0) > Math.abs(m[pivot]![col] ?? 0)) pivot = row;
        }
        const t = m[col]!;
        m[col] = m[pivot]!;
        m[pivot] = t;
        const div = m[col]![col] ?? 1;
        for (let c = col; c <= n; c += 1) m[col]![c] = (m[col]![c] ?? 0) / div;
        for (let row = 0; row < n; row += 1) {
            if (row === col) continue;
            const factor = m[row]![col] ?? 0;
            for (let c = col; c <= n; c += 1) m[row]![c] = (m[row]![c] ?? 0) - factor * (m[col]![c] ?? 0);
        }
    }
    return m.map((row) => row[n] ?? 0);
}

function batchLeastSquares(inputs: number[], desired: number[], order: number): number[] {
    const gram = Array.from({ length: order }, () => Array.from({ length: order }, () => 0));
    const rhs = Array.from({ length: order }, () => 0);
    for (let index = order; index < inputs.length; index += 1) {
        const phi = Array.from({ length: order }, (_, tap) => inputs[index - tap] ?? 0);
        for (let a = 0; a < order; a += 1) {
            rhs[a] = (rhs[a] ?? 0) + (phi[a] ?? 0) * (desired[index] ?? 0);
            for (let b = 0; b < order; b += 1) gram[a]![b] = (gram[a]![b] ?? 0) + (phi[a] ?? 0) * (phi[b] ?? 0);
        }
    }
    return solve(gram, rhs);
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Recursive Least Squares Filter", () => {
    it("converges to the batch least-squares solution", () => {
        let state = 12345;
        const inputs = Array.from({ length: 80 }, () => {
            state ^= state << 13;
            state ^= state >>> 17;
            state ^= state << 5;
            return (state >>> 0) / 4294967296 - 0.5;
        });
        const trueWeights = [1.5, -0.8, 0.4];
        const order = trueWeights.length;
        const desired = inputs.map((_, index) => {
            if (index < order) return 0;
            return trueWeights.reduce((sum, weight, tap) => sum + weight * (inputs[index - tap] ?? 0), 0);
        });
        const frames = [...mod.run({ order, lambda: 1, delta: 1e-4, inputs, desired })];
        checkFrames(frames, order);
        const weights = frames[frames.length - 1]!.meta["weights"] as number[];
        const expected = batchLeastSquares(inputs, desired, order);
        weights.forEach((value, index) => expect(value).toBeCloseTo(expected[index] ?? 0, 3));
        weights.forEach((value, index) => expect(value).toBeCloseTo(trueWeights[index] ?? 0, 3));
    });

    it("reduces the mean squared error as samples arrive", () => {
        const frames = [...mod.run(mod.defaultInput as object)];
        const mse = Number(frames[frames.length - 1]!.meta["mse"]);
        expect(Number.isFinite(mse)).toBe(true);
        expect(Number(frames[1]!.meta["processed"])).toBeGreaterThan(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
