/**
 * fista.test.ts - Independent FISTA reference, LASSO closed form, objective behavior, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./fista";
import type { VisualFrame } from "@/types";

interface Input {
    A: number[][];
    b: number[];
    lambda: number;
    L: number;
    iterations: number;
}

function matVec(M: number[][], x: number[]): number[] {
    return M.map((row) => row.reduce((s, v, j) => s + v * (x[j] ?? 0), 0));
}
function transpose(M: number[][]): number[][] {
    return M[0]!.map((_, j) => M.map((row) => row[j] ?? 0));
}
function matMul(A: number[][], B: number[][]): number[][] {
    return A.map((row) => B[0]!.map((_, j) => row.reduce((s, v, k) => s + v * (B[k]?.[j] ?? 0), 0)));
}
function soft(z: number, th: number): number {
    return z > th ? z - th : z < -th ? z + th : 0;
}

/** Independent FISTA iteration reference. */
function reference(input: Input): number[] {
    const At = transpose(input.A);
    const ATA = matMul(At, input.A);
    const ATb = matVec(At, input.b);
    let xPrev = input.A[0]!.map(() => 0);
    let x = [...xPrev];
    let t = 1;
    for (let k = 0; k < input.iterations; k += 1) {
        const beta = (t - 1) / t;
        const y = x.map((xi, j) => xi + beta * (xi - (xPrev[j] ?? 0)));
        const grad = ATA.map((row, j) => row.reduce((s, v, q) => s + v * (y[q] ?? 0), 0) - (ATb[j] ?? 0));
        const xNext = y.map((yj, j) => soft(yj - grad[j]! / input.L, input.lambda / input.L));
        const tNext = (1 + Math.sqrt(1 + 4 * t * t)) / 2;
        xPrev = x;
        x = xNext;
        t = tNext;
    }
    return x;
}

function checkFrames(frames: VisualFrame[], iterations: number, dim: number): void {
    expect(frames.length).toBe(iterations + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(dim);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Fista", () => {
    it("matches an independent FISTA reference on several problems", () => {
        const cases: Input[] = [
            { A: [[1, 0], [0, 1]], b: [2, -3], lambda: 0.5, L: 1, iterations: 20 },
            { A: [[1, 1], [1, 2], [2, 1]], b: [1, 2, 3], lambda: 0.1, L: 8, iterations: 30 },
            { A: [[2, 0, 1], [0, 3, 1]], b: [4, 5], lambda: 0.3, L: 12, iterations: 25 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.iterations, input.A[0]!.length);
            const final = frames[frames.length - 1]?.meta["x"] as number[];
            const expected = reference(input);
            for (let j = 0; j < input.A[0]!.length; j += 1) {
                expect(final[j]).toBeCloseTo(expected[j]!, 12);
            }
        }
    });

    it("recovers the soft-threshold closed form for an identity dictionary", () => {
        const frames = [...mod.run({ A: [[1, 0], [0, 1]], b: [2, -3], lambda: 0.5, L: 1, iterations: 200 })];
        const final = frames[frames.length - 1]?.meta["x"] as number[];
        expect(final[0]).toBeCloseTo(soft(2, 0.5), 5);
        expect(final[1]).toBeCloseTo(soft(-3, 0.5), 5);
    });

    it("drives the objective well below its initial value", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        const initial = frames[0]!.meta["objective"] as number;
        const final = frames[frames.length - 1]!.meta["objective"] as number;
        expect(final).toBeLessThan(initial);
        expect(final).toBeCloseTo(2.25, 4);
    });

    it("produces a sparse solution under a strong L1 penalty", () => {
        const frames = [...mod.run({ A: [[1, 0], [0, 1]], b: [0.2, 4], lambda: 1, L: 1, iterations: 100 })];
        const final = frames[frames.length - 1]?.meta["x"] as number[];
        expect(final[0]).toBeCloseTo(0, 6);
        expect(final[1]).toBeGreaterThan(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(42);
        expect(generator.next().done).toBe(true);
    });
});
