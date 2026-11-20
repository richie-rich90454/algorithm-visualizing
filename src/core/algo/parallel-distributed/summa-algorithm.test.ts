/**
 * summa-algorithm.test.ts - Matrix product correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { assembleResult, denseMultiply, summaTrace } from "./summa-algorithm";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent triple-loop product without any blocking. */
function referenceProduct(A: number[][], B: number[][]): number[][] {
    const n = A.length;
    const C = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let k = 0; k < n; k += 1) {
            for (let j = 0; j < n; j += 1) {
                (C[i] as number[])[j] = ((C[i] as number[])[j] as number) + (((A[i] as number[])[k] as number) * ((B[k] as number[])[j] as number));
            }
        }
    }
    return C;
}

describe("SUMMA", () => {
    it("matches a naive triple-loop product on several grid sizes", () => {
        for (const grid of [1, 2, 4]) {
            const n = 4;
            const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i * 2 + j - 3));
            const B = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i - j + 1));
            const trace = summaTrace(A, B, grid);
            const assembled = assembleResult(trace, grid);
            const expected = referenceProduct(A, B);
            assembled.forEach((row, i) => row.forEach((value, j) => {
                expect(value).toBe((expected[i] as number[])[j]);
            }));
            expect(denseMultiply(A, B)).toEqual(expected);
        }
    });

    it("reports an exact result in the final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["correct"]).toBe(true);
        expect(Number(final?.["maxError"])).toBe(0);
        expect(Number(final?.["steps"])).toBe(8);
    });

    it("assigns one output block owner per process", () => {
        const trace = summaTrace([[1, 2], [3, 4]], [[5, 6], [7, 8]], 2);
        const processes = new Set(trace.map((step) => step.process));
        expect(processes).toEqual(new Set([0, 1, 2, 3]));
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
