/**
 * four-russians-algorithm.test.ts - Brute-force Boolean product check,
 * frame-shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./four-russians-algorithm";
import type { VisualFrame } from "@/types";

function brute(A: number[][], B: number[][]): number[] {
    const n = A.length;
    const c = Array<number>(n * n).fill(0);
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            let value = 0;
            for (let k = 0; k < n; k += 1) {
                value = value || ((A[i]?.[k] ? 1 : 0) & (B[k]?.[j] ? 1 : 0));
            }
            c[i * n + j] = value;
        }
    }
    return c;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta.n).toBe(n);
    });
}

function randomMatrix(n: number, seedRef: { value: number }): number[][] {
    return Array.from({ length: n }, () =>
        Array.from({ length: n }, () => {
            seedRef.value = (seedRef.value * 1103515245 + 12345) & 0x7fffffff;
            return (seedRef.value >>> 8) & 1;
        }),
    );
}

describe("FourRussiansAlgorithm", () => {
    it("matches a brute-force Boolean product across sizes and block sizes", () => {
        const seedRef = { value: 777 };
        for (const [n, blockSize] of [
            [1, 1],
            [2, 1],
            [4, 2],
            [5, 2],
            [8, 3],
            [8, 1],
        ]) {
            const A = randomMatrix(n, seedRef);
            const B = randomMatrix(n, seedRef);
            const frames = [...mod.run({ A, B, blockSize })];
            checkFrames(frames, n);
            const last = frames[frames.length - 1];
            expect(last?.meta.c).toEqual(brute(A, B));
            expect(last?.meta.blockSize).toBe(blockSize);
        }
    });

    it("uses the derived block size when none is supplied", () => {
        const A = randomMatrix(8, { value: 42 });
        const B = randomMatrix(8, { value: 99 });
        const frames = [...mod.run({ A, B })];
        expect(frames[frames.length - 1]?.meta.c).toEqual(brute(A, B));
        expect(frames[frames.length - 1]?.meta.blockSize).toBe(3);
    });

    it("multiplies identity matrices to identity", () => {
        const identity = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ];
        const frames = [...mod.run({ A: identity, B: identity, blockSize: 2 })];
        expect(frames[frames.length - 1]?.meta.c).toEqual(brute(identity, identity));
    });

    it("handles empty matrices and terminates cleanly", () => {
        const empty = [...mod.run({ A: [], B: [] })];
        expect(empty.length).toBe(1);
        expect(empty[0]?.meta.n).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
