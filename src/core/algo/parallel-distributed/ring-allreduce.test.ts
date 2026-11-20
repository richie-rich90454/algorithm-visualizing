/**
 * ring-allreduce.test.ts - Brute-force sum check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./ring-allreduce";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Rebuild the p-by-p buffer matrix from the flattened metadata array. */
function unflatten(flat: number[], p: number): number[][] {
    return Array.from({ length: p }, (_, w) => flat.slice(w * p, w * p + p));
}

/** Reference: element-wise sum of every worker's p-chunk vector. */
function bruteForceSum(data: number[][], p: number): number[] {
    const sum = Array.from({ length: p }, () => 0);
    for (let w = 0; w < p; w += 1) {
        for (let j = 0; j < p; j += 1) sum[j] += Number(data[w]?.[j] ?? 0);
    }
    return sum;
}

describe("Ring All-Reduce", () => {
    it("matches the element-wise sum on varied inputs", () => {
        const cases: number[][][] = [
            [[10, 11, 12], [20, 21, 22], [30, 31, 32]],
            [[1, 2], [3, 4]],
            [[5, 0, 0, 0], [-5, 0, 0, 0], [10, 0, 0, 0], [0, 0, 0, 0]],
            [[1, 2, 3, 4], [10, 20, 30, 40], [-1, -2, -3, -4], [2, 2, 2, 2]],
        ];
        for (const data of cases) {
            const p = data.length;
            const frames = [...mod.run({ data })];
            checkFrames(frames, p, p);
            const finalBuffers = unflatten(frames[frames.length - 1]!.meta["buffers"] as number[], p);
            const expected = bruteForceSum(data, p);
            for (const row of finalBuffers) expect(row).toEqual(expected);
        }
    });

    it("gives every worker an identical buffer across random trials", () => {
        let seed = 987;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 12; trial += 1) {
            const p = 2 + (rand() % 5);
            const data = Array.from({ length: p }, () => Array.from({ length: p }, () => (rand() % 41) - 20));
            const frames = [...mod.run({ data })];
            const finalBuffers = unflatten(frames[frames.length - 1]!.meta["buffers"] as number[], p);
            const expected = bruteForceSum(data, p);
            expect(finalBuffers).toEqual(Array.from({ length: p }, () => expected));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
