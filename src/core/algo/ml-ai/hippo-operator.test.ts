/** hippo-operator.test.ts - Closed-form matrix, coefficient dynamics, frames, termination. */
import { describe, expect, it } from "vitest";
import mod, { hippoB, hippoH, hippoStep } from "./hippo-operator";
import type { VisualFrame } from "@/types";

/** Independent dense-matrix reference for one bilinear step. */
function referenceStep(H: number[][], B: number[], c: number[], uPrev: number, u: number, s: number): number[] {
    const N = c.length;
    const M = H.map((row, i) => row.map((v, j) => (i === j ? 1 + s * v : s * v)));
    const rhs = c.map((ci, i) => {
        let sum = 0;
        for (let j = 0; j < N; j += 1) sum += (H[i]?.[j] ?? 0) * (c[j] ?? 0);
        return ci - s * sum + s * (B[i] ?? 0) * (uPrev + u);
    });
    // Gaussian elimination on the dense system M y = rhs.
    const A = M.map((row, i) => [...row, rhs[i] ?? 0]);
    for (let col = 0; col < N; col += 1) {
        let pivot = col;
        for (let row = col + 1; row < N; row += 1) {
            if (Math.abs(A[row]?.[col] ?? 0) > Math.abs(A[pivot]?.[col] ?? 0)) pivot = row;
        }
        [A[col], A[pivot]] = [A[pivot] ?? [], A[col] ?? []];
        const pv = A[col]?.[col] ?? 1;
        for (let j = col; j <= N; j += 1) A[col]![j] = (A[col]![j] ?? 0) / pv;
        for (let row = 0; row < N; row += 1) {
            if (row === col) continue;
            const f = A[row]?.[col] ?? 0;
            for (let j = col; j <= N; j += 1) A[row]![j] = (A[row]![j] ?? 0) - f * (A[col]![j] ?? 0);
        }
    }
    return A.map((row) => row[N] ?? 0);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("HiPPO-LegS operator", () => {
    it("H has the closed-form lower-triangular entries and B the basis values", () => {
        const H = hippoH(4);
        expect(H[0]).toEqual([1, 0, 0, 0]);
        expect(H[1]?.[0]).toBeCloseTo(Math.sqrt(3), 12);
        expect(H[2]?.[1]).toBeCloseTo(Math.sqrt(15), 12);
        expect(H[3]?.[3]).toBe(4);
        for (let n = 0; n < 4; n += 1) {
            for (let k = n + 1; k < 4; k += 1) expect(H[n]?.[k]).toBe(0);
        }
        expect(hippoB(3)).toEqual([1, Math.sqrt(3), Math.sqrt(5)]);
    });

    it("triangular solve matches dense Gaussian elimination", () => {
        const H = hippoH(4);
        const B = hippoB(4);
        const c = [0.3, -0.2, 0.7, 0.1];
        const got = hippoStep(H, B, c, 0.5, 1.5, 0.23);
        const expected = referenceStep(H, B, c, 0.5, 1.5, 0.23);
        got.forEach((v, i) => expect(v).toBeCloseTo(expected[i] ?? 0, 10));
    });

    it("a constant signal converges to the first canonical coefficient", () => {
        const H = hippoH(4);
        const B = hippoB(4);
        let c = [0, 0, 0, 0];
        for (let k = 0; k < 400; k += 1) {
            c = hippoStep(H, B, c, 1, 1, 1 / (2 * (k + 0.5)));
        }
        expect(c[0]).toBeCloseTo(1, 3);
        expect(c[1]).toBeCloseTo(0, 3);
        expect(c[2]).toBeCloseTo(0, 3);
        expect(c[3]).toBeCloseTo(0, 3);
    });

    it("emits well-formed frames and terminates", () => {
        const input = mod.defaultInput as { signal: number[]; stateSize: number; dt: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
