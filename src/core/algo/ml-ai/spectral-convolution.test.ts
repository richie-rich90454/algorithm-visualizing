/**
 * spectral-convolution.test.ts - Eigendecomposition, analytic, and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { jacobiEigen, normalizedLaplacian, spectralConvolve } from "./spectral-convolution";
import type { VisualFrame } from "@/types";

type Matrix = number[][];

const mul = (a: Matrix, b: Matrix): Matrix =>
    a.map((row) =>
        Array.from({ length: (b[0] ?? []).length }, (_, j) =>
            row.reduce((sum, value, k) => sum + value * (b[k]?.[j] ?? 0), 0),
        ),
    );

const transpose = (a: Matrix): Matrix =>
    Array.from({ length: (a[0] ?? []).length }, (_, i) => a.map((row) => row[i] ?? 0));

function checkFrames(frames: VisualFrame[], expectedNodes: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(expectedNodes);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.meta["eigenvalues"])).toBe(true);
        expect(Array.isArray(frame.meta["gains"])).toBe(true);
    });
}

describe("Spectral graph convolution", () => {
    it("returns orthonormal eigenvectors that satisfy the eigen equation", () => {
        const matrix: Matrix = [
            [4, 1, 0.5],
            [1, 3, -0.5],
            [0.5, -0.5, 2],
        ];
        const { values, vectors } = jacobiEigen(matrix);
        const left = mul(matrix, vectors);
        for (let i = 0; i < matrix.length; i += 1) {
            for (let k = 0; k < values.length; k += 1) {
                expect(left[i]?.[k]).toBeCloseTo((vectors[i]?.[k] ?? 0) * (values[k] ?? 0), 6);
            }
        }
        const gram = mul(transpose(vectors), vectors);
        for (let i = 0; i < gram.length; i += 1) {
            for (let j = 0; j < gram.length; j += 1) {
                expect(gram[i]?.[j]).toBeCloseTo(i === j ? 1 : 0, 6);
            }
        }
    });

    it("matches the closed-form filter on a complete graph", () => {
        const adjacency: Matrix = [
            [0, 1, 1, 1],
            [1, 0, 1, 1],
            [1, 1, 0, 1],
            [1, 1, 1, 0],
        ];
        const laplacian = normalizedLaplacian(adjacency);
        expect(laplacian[0]?.[0]).toBeCloseTo(1, 12);
        expect(laplacian[0]?.[1]).toBeCloseTo(-1 / 3, 12);
        const signal = [1, 2, 3, 4];
        const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
        const result = spectralConvolve(adjacency, signal, 0.7, 0.2);
        expect(result.values[0]).toBeCloseTo(0, 6);
        for (let k = 1; k < result.values.length; k += 1) {
            expect(result.values[k]).toBeCloseTo(4 / 3, 6);
        }
        result.output.forEach((value, i) => {
            expect(value).toBeCloseTo(0.7 * mean + 0.2 * ((signal[i] ?? 0) - mean), 6);
        });
    });

    it("produces well-formed frames and terminates", () => {
        const input = mod.defaultInput as { signal: number[] };
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames, input.signal.length);
        const last = frames[frames.length - 1];
        const result = spectralConvolve(
            (mod.defaultInput as { adjacency: Matrix }).adjacency,
            input.signal,
            1,
            0,
        );
        for (let i = 0; i < input.signal.length; i += 1) {
            expect(Number((last?.meta["output"] as number[])?.[i])).toBeCloseTo(result.output[i] ?? 0, 8);
        }
        expect(generator.next().done).toBe(true);
    });
});
