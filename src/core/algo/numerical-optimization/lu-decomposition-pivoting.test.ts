/**
 * lu-decomposition-pivoting.test.ts - Brute-force verification that P A equals
 * L U, plus triangularity, pivot, frame-shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./lu-decomposition-pivoting";
import type { VisualFrame } from "@/types";

type Matrix = number[][];

function fromFlat(flat: number[], n: number): Matrix {
    return Array.from({ length: n }, (_, i) => flat.slice(i * n, i * n + n));
}

function multiply(a: Matrix, b: Matrix): Matrix {
    const n = a.length;
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => {
            let sum = 0;
            for (let k = 0; k < n; k += 1) {
                sum += (a[i]?.[k] ?? 0) * (b[k]?.[j] ?? 0);
            }
            return sum;
        }),
    );
}

function expectClose(a: Matrix, b: Matrix, tolerance = 1e-8): void {
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < (a[i]?.length ?? 0); j += 1) {
            expect(Math.abs((a[i]?.[j] ?? 0) - (b[i]?.[j] ?? 0))).toBeLessThan(tolerance);
        }
    }
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["n"]).toBe(n);
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("LU Decomposition with Partial Pivoting", () => {
    it("reconstructs the matrix as P A = L U on the default input", () => {
        const input = mod.defaultInput as { matrix: Matrix };
        const frames = [...mod.run(input)];
        const n = input.matrix.length;
        checkFrames(frames, n);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta["singular"]).toBe(false);

        const l = fromFlat(finalMeta["l"] as number[], n);
        const u = fromFlat(finalMeta["u"] as number[], n);
        const perm = finalMeta["perm"] as number[];
        const permuted = perm.map((row) => input.matrix[row] ?? []);
        expectClose(multiply(l, u), permuted);

        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                if (i === j) {
                    expect(l[i]?.[j]).toBe(1);
                } else if (i < j) {
                    expect(l[i]?.[j]).toBe(0);
                }
                if (i > j) {
                    expect(u[i]?.[j]).toBe(0);
                }
            }
        }
    });

    it("performs a row swap when the first pivot is zero", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const finalMeta = frames[frames.length - 1]?.meta;
        const perm = finalMeta["perm"] as number[];
        expect(perm[0]).not.toBe(0);
        expect(frames.some((f) => f.description.includes("swapped"))).toBe(true);
    });

    it("factors a matrix that needs no pivoting", () => {
        const matrix: Matrix = [
            [4, 1],
            [2, 3],
        ];
        const frames = [...mod.run({ matrix })];
        const meta = frames[frames.length - 1]?.meta;
        const l = fromFlat(meta["l"] as number[], 2);
        const u = fromFlat(meta["u"] as number[], 2);
        expectClose(multiply(l, u), matrix);
        expect(meta["perm"]).toEqual([0, 1]);
    });

    it("reports singularity instead of dividing by zero", () => {
        const frames = [...mod.run({ matrix: [[1, 2], [2, 4]] })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta["singular"]).toBe(true);
        expect(meta["l"]).toBeUndefined();
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
