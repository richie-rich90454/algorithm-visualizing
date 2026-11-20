/** ansari-bradley-test.test.ts - brute-force distance scores, T, exact p, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./ansari-bradley-test";
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

function referenceMedian(values: number[]): number {
    const s = [...values].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] as number : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

function referenceExact(scores: number[], n: number, observedT: number): number {
    const N = scores.length;
    const center = (scores.reduce((s, v) => s + v, 0) * n) / N;
    const deviation = Math.abs(observedT - center);
    let extreme = 0;
    let count = 0;
    const pick = (start: number, chosen: number[]): void => {
        if (chosen.length === n) {
            count += 1;
            const t = chosen.reduce((s, i) => s + (scores[i] ?? 0), 0);
            if (Math.abs(t - center) >= deviation - 1e-9) extreme += 1;
            return;
        }
        for (let i = start; i < N; i += 1) pick(i + 1, [...chosen, i]);
    };
    pick(0, []);
    return extreme / count;
}

function checkFrames(frames: VisualFrame[], N: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * N);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Ansari-Bradley Test", () => {
    it("matches brute-force median, distance scores, T, and exact p", () => {
        const cases: Array<{ x: number[]; y: number[] }> = [
            { x: [4, 6, 8, 10, 12], y: [6, 7, 8, 9, 10] },
            { x: [1, 2, 3, 4], y: [5, 6, 7, 8] },
            { x: [5, 5, 5, 5], y: [1, 9, 1, 9] },
            { x: [2, 4, 6], y: [3, 5, 7] },
        ];
        for (const { x, y } of cases) {
            const frames = [...mod.run({ x, y })];
            checkFrames(frames, x.length + y.length);
            const final = frames.at(-1)?.meta;
            const pooled = [...x, ...y];
            const med = referenceMedian(pooled);
            const scores = referenceRanks(pooled.map((v) => Math.abs(v - med)));
            const t = x.reduce((s, _v, i) => s + (scores[i] ?? 0), 0);
            expect(Number(final?.["median"])).toBeCloseTo(med, 9);
            expect(Number(final?.["tStat"])).toBeCloseTo(t, 9);
            expect(Number(final?.["pValue"])).toBeCloseTo(referenceExact(scores, x.length, t), 9);
        }
    });

    it("score sums of all observations equal N(N+1)/2 and T stays in range", () => {
        const final = [...mod.run({ x: [4, 6, 8, 10, 12], y: [6, 7, 8, 9, 10] })].at(-1)?.meta;
        const N = Number(final?.["N"]) as number;
        const n = Number(final?.["n"]) as number;
        expect(Number(final?.["expectedT"])).toBeCloseTo((n * (N + 1)) / 2, 9);
        expect(Number(final?.["pValue"])).toBeGreaterThanOrEqual(0);
        expect(Number(final?.["pValue"])).toBeLessThanOrEqual(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
