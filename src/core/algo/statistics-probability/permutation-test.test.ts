/**
 * permutation-test.test.ts - Exact reference enumeration, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./permutation-test";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], combinations: number): void {
    expect(frames.length).toBe(combinations + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        const diffs = frame.meta["diffs"] as number[];
        const counts = frame.meta["counts"] as number[];
        expect(diffs.length).toBe(counts.length);
    });
}

/** Choose k indices from n by independent recursion and collect mean differences. */
function referencePValue(a: number[], b: number[]): number {
    const pooled = [...a, ...b];
    const n1 = a.length;
    const n2 = b.length;
    const observed = a.reduce((s, v) => s + v, 0) / n1 - b.reduce((s, v) => s + v, 0) / n2;
    const differences: number[] = [];
    const recurse = (start: number, chosen: number[]): void => {
        if (chosen.length === n1) {
            let sumA = 0;
            let sumB = 0;
            const inA = new Set(chosen);
            for (let i = 0; i < pooled.length; i += 1) {
                if (inA.has(i)) {
                    sumA += pooled[i]!;
                } else {
                    sumB += pooled[i]!;
                }
            }
            differences.push(sumA / n1 - sumB / n2);
            return;
        }
        for (let i = start; i < pooled.length; i += 1) {
            recurse(i + 1, [...chosen, i]);
        }
    };
    recurse(0, []);
    const extreme = differences.filter((d) => Math.abs(d) >= Math.abs(observed) - 1e-12).length;
    return extreme / differences.length;
}

function choose(n: number, k: number): number {
    let r = 1;
    for (let i = 0; i < k; i += 1) {
        r = (r * (n - i)) / (i + 1);
    }
    return Math.round(r);
}

describe("Exact permutation test", () => {
    it("matches an independent exhaustive relabeling", () => {
        const cases: Array<{ groupA: number[]; groupB: number[] }> = [
            { groupA: [1, 2, 3, 4], groupB: [5, 6, 7, 8] },
            { groupA: [2, 4, 6], groupB: [1, 3, 5, 7] },
            { groupA: [10, 12, 11, 13, 9], groupB: [1, 2, 3, 4] },
        ];
        for (const testCase of cases) {
            const total = choose(testCase.groupA.length + testCase.groupB.length, testCase.groupA.length);
            const frames = [...mod.run(testCase)];
            checkFrames(frames, total);
            const meta = frames[frames.length - 1]?.meta;
            expect(Number(meta?.["permutations"])).toBe(total);
            expect(Number(meta?.["pValue"])).toBeCloseTo(referencePValue(testCase.groupA, testCase.groupB), 12);
        }
    });

    it("has a histogram that sums to the number of permutations and a p-value in range", () => {
        const frames = [...mod.run({ groupA: [1, 2, 3, 4], groupB: [5, 6, 7, 8] })];
        checkFrames(frames, 70);
        const meta = frames[frames.length - 1]?.meta;
        const counts = meta?.["counts"] as number[];
        expect(counts.reduce((s, c) => s + c, 0)).toBe(70);
        const pValue = Number(meta?.["pValue"]);
        expect(pValue).toBeGreaterThan(0);
        expect(pValue).toBeLessThanOrEqual(1);
        let previousExtreme = 0;
        for (const frame of frames.slice(2)) {
            const currentExtreme = Number(frame.meta["extreme"]);
            expect(currentExtreme).toBeGreaterThanOrEqual(previousExtreme);
            previousExtreme = currentExtreme;
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(73);
        expect(generator.next().done).toBe(true);
    });
});
