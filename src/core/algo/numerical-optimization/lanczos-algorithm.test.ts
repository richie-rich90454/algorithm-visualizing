/**
 * lanczos-algorithm.test.ts - Independent Lanczos recurrence, Ritz cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lanczos-algorithm";
import type { VisualFrame } from "@/types";

function matVec(A: number[][], x: number[]): number[] {
    return A.map((row) => row.reduce((s, v, j) => s + v * (x[j] ?? 0), 0));
}
function dot(a: number[], b: number[]): number { return a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0); }
function norm(a: number[]): number { return Math.sqrt(dot(a, a)); }

/** Independent full-reorthogonalization Lanczos recurrence. */
function referenceLanczos(A: number[][], steps: number) {
    const n = A.length;
    const q: number[][] = [];
    const q0 = new Array<number>(n).fill(0);
    q0[0] = 1;
    q.push(q0);
    const alphas: number[] = [];
    const betas: number[] = [];
    for (let j = 0; j < steps; j += 1) {
        const qj = q[j] as number[];
        const w = matVec(A, qj);
        alphas.push(dot(qj, w));
        for (const qi of q) {
            const c = dot(qi, w);
            for (let k = 0; k < n; k += 1) w[k] = (w[k] ?? 0) - c * (qi[k] ?? 0);
        }
        betas.push(norm(w));
        if ((betas[j] as number) <= 1e-10) break;
        if (j + 1 < steps) q.push(w.map((v) => v / (betas[j] as number)));
    }
    return { alphas, betas };
}

/** Exact eigenvalues of a symmetric 2x2 matrix. */
function ritz2(a: number, d: number, b: number): [number, number] {
    const mid = (a + d) / 2;
    const delta = Math.sqrt(((a - d) / 2) ** 2 + b * b);
    return [mid + delta, mid - delta];
}

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(frames.length).toBeLessThanOrEqual(steps + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Lanczos algorithm", () => {
    it("matches an independent Lanczos recurrence", () => {
        const cases: Array<{ matrix: number[][]; steps: number }> = [
            { matrix: [[4, 1, 0], [1, 3, 1], [0, 1, 2]], steps: 3 },
            { matrix: [[2, 1], [1, 5]], steps: 2 },
            { matrix: [[3, 0, 0], [0, -1, 0], [0, 0, 7]], steps: 3 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.steps);
            const expected = referenceLanczos(testCase.matrix, testCase.steps);
            const meta = frames[frames.length - 1]?.meta;
            const alphas = meta?.["alphas"] as number[];
            const betas = meta?.["betas"] as number[];
            expect(alphas.length).toBe(expected.alphas.length);
            for (let i = 0; i < expected.alphas.length; i += 1) {
                expect(alphas[i]).toBeCloseTo(expected.alphas[i] as number, 9);
                expect(betas[i]).toBeCloseTo(expected.betas[i] as number, 9);
            }
        }
    });

    it("produces Ritz values matching the tridiagonal and bracketing true extremes", () => {
        const matrix = [[2, 1], [1, 5]];
        const frames = [...mod.run({ matrix, steps: 2 })];
        const meta = frames[frames.length - 1]?.meta;
        const alphas = meta?.["alphas"] as number[];
        const betas = meta?.["betas"] as number[];
        const ritz = meta?.["ritz"] as number[];
        const expected = ritz2(alphas[0] as number, alphas[1] as number, betas[0] as number);
        expect(ritz[0]).toBeCloseTo(expected[0], 9);
        expect(ritz[1]).toBeCloseTo(expected[1], 9);
        // True eigenvalues of [[2,1],[1,5]] are (7 +/- sqrt(13))/2.
        expect(Math.max(...ritz)).toBeCloseTo((7 + Math.sqrt(13)) / 2, 9);
        expect(Math.min(...ritz)).toBeCloseTo((7 - Math.sqrt(13)) / 2, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
