/** friedman-test.test.ts - brute-force within-block ranks and Q, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./friedman-test";
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

function referenceFriedman(data: number[][]): { sums: number[]; q: number; correction: number } {
    const n = data.length;
    const k = (data[0] as number[]).length;
    const sums = new Array<number>(k).fill(0);
    let tie = 0;
    for (const row of data) {
        const ranks = referenceRanks(row);
        ranks.forEach((r, j) => { sums[j] = (sums[j] as number) + r; });
        const counts = new Map<number, number>();
        for (const v of row) counts.set(v, (counts.get(v) ?? 0) + 1);
        for (const size of counts.values()) tie += size ** 3 - size;
    }
    const correction = 1 - tie / (n * k * (k * k - 1));
    const raw = sums.reduce((s, v) => s + v * v, 0);
    const q = ((12 / (n * k * (k + 1))) * raw - 3 * n * (k + 1)) / (correction > 0 ? correction : 1);
    return { sums, q, correction };
}

function checkFrames(frames: VisualFrame[], n: number, k: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * k);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Friedman Test", () => {
    it("matches brute-force rank sums and Q on several tables, with and without ties", () => {
        const cases: number[][][] = [
            [[7, 4, 5], [8, 4, 6], [9, 5, 7], [6, 3, 4], [7, 5, 6]],
            [[1, 2, 3], [1, 2, 3], [1, 2, 3]],
            [[3, 3, 3], [2, 2, 2], [1, 1, 1]],
            [[5, 1, 3, 4], [2, 4, 1, 5], [3, 2, 5, 1], [4, 5, 2, 3]],
        ];
        for (const data of cases) {
            const frames = [...mod.run({ data })];
            const n = data.length;
            const k = (data[0] as number[]).length;
            checkFrames(frames, n, k);
            const ref = referenceFriedman(data);
            const final = frames.at(-1)?.meta;
            const sums = final?.["rankSums"] as number[];
            sums.forEach((s, i) => expect(s).toBeCloseTo(ref.sums[i] as number, 9));
            expect(sums.reduce((a, b) => a + b, 0)).toBeCloseTo((n * k * (k + 1)) / 2, 9);
            expect(Number(final?.["correction"])).toBeCloseTo(ref.correction, 9);
            expect(Number(final?.["q"])).toBeCloseTo(ref.q, 9);
        }
    });

    it("gives Q = 0 and correction = 1 for identical treatment columns", () => {
        const final = [...mod.run({ data: [[1, 2, 3], [2, 3, 1], [3, 1, 2]] })].at(-1)?.meta;
        expect(Number(final?.["q"])).toBeCloseTo(0, 9);
        expect(Number(final?.["correction"])).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
