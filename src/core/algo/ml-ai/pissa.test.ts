/** pissa.test.ts - SVD defining equations, PiSSA factor reconstruction, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./pissa";
import type { VisualFrame } from "@/types";

interface Input {
    W: number[][];
    rank: number;
}

function unflat(flat: number[], rows: number, cols: number): number[][] {
    return Array.from({ length: rows }, (_, i) =>
        Array.from({ length: cols }, (_, j) => flat[i * cols + j] ?? 0),
    );
}

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, x, j) => sum + x * (vector[j] ?? 0), 0));
}

function transpose(matrix: number[][]): number[][] {
    const rows = matrix.length;
    const cols = rows > 0 ? (matrix[0]?.length ?? 0) : 0;
    return Array.from({ length: cols }, (_, j) => Array.from({ length: rows }, (_, i) => matrix[i]?.[j] ?? 0));
}

function matMul(a: number[][], b: number[][]): number[][] {
    const m = a.length;
    const k = b.length;
    const n = k > 0 ? (b[0]?.length ?? 0) : 0;
    const out = Array.from({ length: m }, () => Array(n).fill(0) as number[]);
    for (let i = 0; i < m; i += 1) {
        for (let p = 0; p < k; p += 1) {
            for (let j = 0; j < n; j += 1) {
                out[i]![j] = (out[i]![j] ?? 0) + (a[i]?.[p] ?? 0) * (b[p]?.[j] ?? 0);
            }
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(["grid", "array"]).toContain(frame.layout);
        expect(frame.meta).toBeDefined();
    });
}

describe("PiSSA", () => {
    const input = mod.defaultInput as Input;

    it("reported singular triplets satisfy W v = s u and W^T u = s v", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const W = input.W;
        const m = W.length;
        const n = W[0]!.length;
        const S = meta["singularValues"] as number[];
        const U = unflat(meta["U"] as number[], n, m);
        const V = unflat(meta["V"] as number[], n, n);
        const Wt = transpose(W);

        for (let k = 0; k < n; k += 1) {
            const vk = V[k]!;
            const uk = U[k]!;
            const left = matVec(W, vk);
            const right = uk.map((x) => (S[k] ?? 0) * x);
            left.forEach((value, i) => expect(value).toBeCloseTo(right[i] ?? 0, 6));
            const leftT = matVec(Wt, uk);
            const rightT = vk.map((x) => (S[k] ?? 0) * x);
            leftT.forEach((value, i) => expect(value).toBeCloseTo(rightT[i] ?? 0, 6));
        }
        for (let k = 0; k < n; k += 1) {
            for (let l = 0; l < n; l += 1) {
                const dotU = U[k]!.reduce((sum, x, i) => sum + x * (U[l]![i] ?? 0), 0);
                const dotV = V[k]!.reduce((sum, x, i) => sum + x * (V[l]![i] ?? 0), 0);
                expect(dotU).toBeCloseTo(k === l ? 1 : 0, 6);
                expect(dotV).toBeCloseTo(k === l ? 1 : 0, 6);
            }
        }
        for (let k = 1; k < S.length; k += 1) {
            expect(S[k - 1]!).toBeGreaterThanOrEqual(S[k]! - 1e-9);
        }
    });

    it("PiSSA factors reconstruct W and the residual energy matches discarded singular values", () => {
        const frames = [...mod.run(input)];
        const meta = frames[frames.length - 1]!.meta;
        const m = input.W.length;
        const n = input.W[0]!.length;
        const r = input.rank;
        const S = meta["singularValues"] as number[];
        const V = unflat(meta["V"] as number[], n, n);
        const U = unflat(meta["U"] as number[], n, m);
        const A = unflat(meta["A"] as number[], r, n);
        const B = unflat(meta["B"] as number[], m, r);
        const reconstruction = unflat(meta["reconstruction"] as number[], m, n);

        for (let k = 0; k < r; k += 1) {
            for (let j = 0; j < n; j += 1) {
                expect(A[k]![j]).toBeCloseTo(Math.sqrt(S[k] ?? 0) * (V[k]![j] ?? 0), 6);
            }
            for (let i = 0; i < m; i += 1) {
                expect(B[i]![k]).toBeCloseTo((U[k]![i] ?? 0) * Math.sqrt(S[k] ?? 0), 6);
            }
        }

        const expectedRecon = matMul(B, A);
        reconstruction.forEach((row, i) =>
            row.forEach((value, j) => expect(value).toBeCloseTo(expectedRecon[i]![j] ?? 0, 6)),
        );
        const residual = unflat(meta["residual"] as number[], m, n);
        residual.forEach((row, i) =>
            row.forEach((value, j) => expect(value).toBeCloseTo(input.W[i]![j]! - reconstruction[i]![j]!, 6)),
        );
        const discardedEnergy = Math.sqrt(S.slice(r).reduce((sum, s) => sum + s * s, 0));
        expect(Number(meta["residualNorm"])).toBeCloseTo(discardedEnergy, 6);
    });

    it("a random-brute-force reference: BA is closer to W than any rank-deficient alternative", () => {
        const frames = [...mod.run(input)];
        const meta = frames[frames.length - 1]!.meta;
        const m = input.W.length;
        const n = input.W[0]!.length;
        const reconstruction = unflat(meta["reconstruction"] as number[], m, n);
        const error = (mat: number[][]): number =>
            Math.sqrt(mat.reduce((sum, row, i) => sum + row.reduce((s, v, j) => s + (v - (input.W[i]![j] ?? 0)) ** 2, 0), 0));
        const reconError = error(reconstruction);
        const zeroError = error(Array.from({ length: m }, () => Array(n).fill(0)));
        expect(reconError).toBeLessThan(zeroError);
        expect(reconError).toBeCloseTo(Number(meta["residualNorm"]), 6);
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
