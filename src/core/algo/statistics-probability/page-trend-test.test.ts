/** page-trend-test.test.ts - brute-force rank sums and L/z, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./page-trend-test";
import type { VisualFrame } from "@/types";

function referenceRanks(values: number[]): number[] {
    const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const out = new Array<number>(values.length).fill(0);
    let i = 0;
    while (i < order.length) {
        let j = i;
        while (j < order.length && (order[j] as { v: number }).v === (order[i] as { v: number }).v) j += 1;
        const avg = (i + 1 + j) / 2;
        for (let k = i; k < j; k += 1) out[(order[k] as { i: number }).i] = avg;
        i = j;
    }
    return out;
}

function referencePage(data: number[][]): { lStat: number; expected: number; variance: number; z: number } {
    const n = data.length;
    const k = (data[0] as number[]).length;
    const sums = new Array<number>(k).fill(0);
    for (const row of data) {
        const ranks = referenceRanks(row);
        ranks.forEach((r, j) => { sums[j] = (sums[j] as number) + r; });
    }
    let lStat = 0;
    sums.forEach((s, j) => { lStat += (j + 1) * s; });
    const expected = (n * k * (k + 1) ** 2) / 4;
    const variance = (n * k * k * (k + 1) * (k * k - 1)) / 144;
    return { lStat, expected, variance, z: (lStat - expected) / Math.sqrt(variance) };
}

function checkFrames(frames: VisualFrame[], n: number, k: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * k);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Page's Trend Test", () => {
    it("matches brute-force L, expectation, variance, and z", () => {
        const cases: number[][][] = [
            [[3, 5, 7, 9], [2, 4, 6, 8], [4, 4, 7, 10], [1, 3, 5, 7]],
            [[1, 2, 3], [1, 2, 3], [1, 2, 3]],
            [[9, 7, 5], [8, 6, 4], [7, 5, 3]],
        ];
        for (const data of cases) {
            const frames = [...mod.run({ data })];
            checkFrames(frames, data.length, (data[0] as number[]).length);
            const ref = referencePage(data);
            const final = frames.at(-1)?.meta;
            expect(Number(final?.["lStat"])).toBeCloseTo(ref.lStat, 9);
            expect(Number(final?.["expectedL"])).toBeCloseTo(ref.expected, 9);
            expect(Number(final?.["varianceL"])).toBeCloseTo(ref.variance, 9);
            expect(Number(final?.["z"])).toBeCloseTo(ref.z, 9);
        }
    });

    it("z is positive for an ascending trend and negative for a descending trend", () => {
        const asc = Number([...mod.run({ data: [[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4]] })].at(-1)?.meta["z"]);
        const desc = Number([...mod.run({ data: [[4, 3, 2, 1], [4, 3, 2, 1], [4, 3, 2, 1]] })].at(-1)?.meta["z"]);
        expect(asc).toBeGreaterThan(0);
        expect(desc).toBeLessThan(0);
        expect(asc).toBeCloseTo(-desc, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
