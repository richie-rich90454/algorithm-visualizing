/** mann-whitney-u-test.test.ts - Brute-force rank/U/p cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./mann-whitney-u-test";
import type { VisualFrame } from "@/types";

/** Independent rank vector with tie averaging (sort-then-scan by value). */
function referenceRanks(values: number[]): number[] {
    const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const out = new Array<number>(values.length).fill(0);
    for (let i = 0; i < order.length; ) {
        let j = i;
        while (j < order.length && (order[j] as { v: number }).v === (order[i] as { v: number }).v) j += 1;
        const avg = (i + 1 + j) / 2;
        for (let k = i; k < j; k += 1) out[(order[k] as { i: number }).i] = avg;
        i = j;
    }
    return out;
}

/** Independent exact p-value via all subsets of positions for sample x. */
function referenceExact(ranks: number[], n1: number, observedU: number): number {
    const n = ranks.length;
    const n2 = n - n1;
    let extreme = 0;
    let total = 0;
    const recurse = (start: number, picked: number[]): void => {
        if (picked.length === n1) {
            total += 1;
            const r1 = picked.reduce((s, i) => s + (ranks[i] ?? 0), 0);
            const u1 = r1 - (n1 * (n1 + 1)) / 2;
            const u2 = n1 * n2 - u1;
            if (Math.min(u1, u2) <= observedU + 1e-9) extreme += 1;
            return;
        }
        for (let i = start; i < n; i += 1) recurse(i + 1, [...picked, i]);
    };
    recurse(0, []);
    return extreme / total;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(3 * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Mann-Whitney U Test", () => {
    it("matches brute-force U and exact p-value on several samples", () => {
        const cases: Array<{ x: number[]; y: number[] }> = [
            { x: [5, 8, 6, 9, 7], y: [3, 4, 1, 2, 0] },
            { x: [1, 2, 3], y: [4, 5, 6] },
            { x: [1, 3, 5], y: [2, 4, 6] },
            { x: [2, 2, 2], y: [1, 1, 1, 1] },
            { x: [1, 1, 2], y: [1, 2, 2] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            const n = testCase.x.length + testCase.y.length;
            checkFrames(frames, n);
            const final = frames[frames.length - 1]?.meta;
            const ranks = referenceRanks([...testCase.x, ...testCase.y]);
            const r1 = testCase.x.reduce((s, _v, i) => s + (ranks[i] ?? 0), 0);
            const u1 = r1 - (testCase.x.length * (testCase.x.length + 1)) / 2;
            const u2 = testCase.x.length * testCase.y.length - u1;
            const u = Math.min(u1, u2);
            expect(Number(final?.["u1"])).toBeCloseTo(u1, 9);
            expect(Number(final?.["u2"])).toBeCloseTo(u2, 9);
            expect(Number(final?.["u"])).toBeCloseTo(u, 9);
            expect(Number(final?.["u1"]) + Number(final?.["u2"])).toBeCloseTo(testCase.x.length * testCase.y.length, 9);
            expect(Number(final?.["pValue"])).toBeCloseTo(referenceExact(ranks, testCase.x.length, u), 9);
        }
    });

    it("assigns averaged ranks for ties", () => {
        const frames = [...mod.run({ x: [5, 5], y: [5, 5] })];
        const rankCells = frames[0]?.entities.filter((e) => e.metadata["row"] === 1) ?? [];
        const rankValues = rankCells.map((e) => Number(e.metadata["rank"])).sort((a, b) => a - b);
        expect(rankValues).toEqual([2.5, 2.5, 2.5, 2.5]);
    });

    it("gives a small p-value for perfect separation and near one for identical samples", () => {
        const separated = Number([...mod.run({ x: [10, 11, 12, 13], y: [1, 2, 3, 4] })].at(-1)?.meta["pValue"]);
        const identical = Number([...mod.run({ x: [4, 5, 6], y: [4, 5, 6] })].at(-1)?.meta["pValue"]);
        expect(separated).toBeLessThan(0.1);
        expect(identical).toBeGreaterThan(0.8);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
