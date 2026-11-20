/** kfac.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod, { invertMatrix, kfacStep } from "./kfac";
import type { VisualFrame } from "@/types";

function transpose(m: number[][]): number[][] {
    return m[0].map((_, c) => m.map((row) => row[c]));
}
function multiply(a: number[][], b: number[][]): number[][] {
    return a.map((row) => b[0].map((_, c) => row.reduce((s, v, k) => s + v * b[k][c], 0)));
}
function close(a: number[][], b: number[][], eps = 1e-6): void {
    a.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(b[i][j], -Math.log10(eps))));
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

describe("KFAC", () => {
    it("inverts matrices correctly", () => {
        const m = [[4, 2], [1, 3]];
        close(multiply(invertMatrix(m), m), [[1, 0], [0, 1]]);
    });

    it("matches independently recomputed factors and natural gradient", () => {
        const input = mod.defaultInput as { x: number[][]; dY: number[][]; damping: number };
        const { x, dY, damping } = input;
        const result = kfacStep(x, dY, damping);
        const frames = [...mod.run(input)];
        checkFrames(frames, result.naturalGrad.length, result.naturalGrad[0].length);

        const dyt = transpose(dY);
        const expectedA = Array.from({ length: x[0].length }, (_, i) =>
            Array.from({ length: x[0].length }, (_, j) => x.reduce((s, row) => s + row[i] * row[j], 0) / x.length));
        const expectedS = Array.from({ length: dY[0].length }, (_, i) =>
            Array.from({ length: dY[0].length }, (_, j) => dY.reduce((s, row) => s + row[i] * row[j], 0) / dY.length));
        close(result.A, expectedA);
        close(result.S, expectedS);

        const dA = result.A.map((row, i) => row.map((v, j) => v + (i === j ? damping : 0)));
        const dS = result.S.map((row, i) => row.map((v, j) => v + (i === j ? damping : 0)));
        close(multiply(result.invA, dA), [[1, 0], [0, 1]]);
        close(multiply(result.invS, dS), [[1, 0], [0, 1]]);

        const expectedGrad = multiply(dyt, x).map((r) => r.map((v) => v / x.length));
        close(result.grad, expectedGrad);
        close(result.naturalGrad, multiply(multiply(result.invS, expectedGrad), result.invA));
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
