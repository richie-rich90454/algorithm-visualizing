/**
 * determinant-gaussian.test.ts - Brute-force correctness, frame-shape, and
 * termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./determinant-gaussian";
import type { VisualFrame } from "@/types";

/** Independent determinant by recursive Laplace expansion. */
function determinantReference(matrix: number[][]): number {
    const n = matrix.length;
    if (n === 1) {
        return matrix[0]?.[0] ?? 0;
    }
    if (n === 2) {
        return (matrix[0]?.[0] ?? 0) * (matrix[1]?.[1] ?? 0)
            - (matrix[0]?.[1] ?? 0) * (matrix[1]?.[0] ?? 0);
    }
    let total = 0;
    for (let col = 0; col < n; col += 1) {
        const minor = matrix.slice(1).map((row) => row.filter((_value, index) => index !== col));
        const sign = col % 2 === 0 ? 1 : -1;
        total += sign * (matrix[0]?.[col] ?? 0) * determinantReference(minor);
    }
    return total;
}

/** Deterministic pseudo-random generator so failures are reproducible. */
function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

function finalDet(frames: VisualFrame[]): number {
    return Number(frames[frames.length - 1]?.meta["det"]);
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(n);
    });
}

describe("Determinant by Gaussian Elimination", () => {
    it("matches a Laplace-expansion reference on random integer matrices", () => {
        const random = makeRandom(20261119);
        for (let n = 1; n <= 5; n += 1) {
            for (let trial = 0; trial < 12; trial += 1) {
                const matrix = Array.from({ length: n }, () =>
                    Array.from({ length: n }, () => Math.floor(random() * 9) - 4),
                );
                const frames = [...mod.run({ matrix })];
                checkFrames(frames, n);
                expect(Math.abs(finalDet(frames) - determinantReference(matrix))).toBeLessThan(1e-6);
            }
        }
    });

    it("handles identity, triangular, and singular matrices", () => {
        const identity = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ];
        const triangular = [
            [2, 5, 1],
            [0, 3, 4],
            [0, 0, 6],
        ];
        const singular = [
            [1, 2, 3],
            [2, 4, 6],
            [7, 8, 9],
        ];
        expect(finalDet([...mod.run({ matrix: identity })])).toBeCloseTo(1, 9);
        expect(finalDet([...mod.run({ matrix: triangular })])).toBeCloseTo(36, 9);
        expect(finalDet([...mod.run({ matrix: singular })])).toBeCloseTo(0, 9);
    });

    it("matches the known determinant of the default matrix", () => {
        const input = mod.defaultInput as { matrix: number[][] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.matrix.length);
        expect(finalDet(frames)).toBeCloseTo(determinantReference(input.matrix), 9);
        expect(finalDet(frames)).toBeCloseTo(-2, 9);
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
