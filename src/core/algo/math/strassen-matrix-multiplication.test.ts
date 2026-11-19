/**
 * strassen-matrix-multiplication.test.ts - Naive multiplication cross-check,
 * padding check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./strassen-matrix-multiplication";
import type { VisualFrame } from "@/types";

function naive(a: number[][], b: number[][]): number[][] {
    const n = a.length;
    const out = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let sum = 0;
            for (let k = 0; k < n; k += 1) sum += a[i]![k]! * b[k]![j]!;
            out[i]![j] = sum;
        }
    }
    return out;
}

function finalC(frames: VisualFrame[]): number[] {
    return frames[frames.length - 1]!.meta["flatC"] as number[];
}

function checkFrames(frames: VisualFrame[]): void {
    const n = frames[0]!.meta["n"] as number;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["flatC"] as number[]).length).toBe(n * n);
    });
}

describe("StrassenMatrixMultiplication", () => {
    it("matches naive multiplication on several matrices", () => {
        const cases: Array<[number[][], number[][]]> = [
            [[[1, 2], [3, 4]], [[5, 6], [7, 8]]],
            [[[2, 0, 1], [1, 3, 2], [0, 1, 4]], [[1, 2, 0], [3, 1, 1], [2, 0, 5]]],
            [[[3]], [[7]]],
            [
                [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]],
                [[16, 15, 14, 13], [12, 11, 10, 9], [8, 7, 6, 5], [4, 3, 2, 1]],
            ],
        ];
        for (const [a, b] of cases) {
            const frames = [...mod.run({ a, b })];
            checkFrames(frames);
            const n = frames[0]!.meta["n"] as number;
            const expected = naive(a, b);
            const got = finalC(frames);
            for (let i = 0; i < a.length; i += 1) {
                for (let j = 0; j < b[0]!.length; j += 1) {
                    expect(got[i * n + j]).toBe(expected[i]![j]!);
                }
            }
            expect(n).toBeGreaterThanOrEqual(a.length);
        }
    });

    it("handles larger non-power-of-two matrices by padding", () => {
        const a = [[1, 2, 3], [4, 5, 6]];
        const b = [[7, 8], [9, 10], [11, 12]];
        const frames = [...mod.run({ a, b })];
        checkFrames(frames);
        expect(frames[0]!.meta["padded"]).toBe(true);
        const paddedA = frames[0]!.meta["flatA"] as number[];
        expect(paddedA.length).toBe(16);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
