/** wilcoxon-signed-rank.test.ts - brute-force signed-rank W and exact p, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./wilcoxon-signed-rank";
import type { VisualFrame } from "@/types";

/** Independent midranks: sort by value, assign average of occupied positions. */
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

/** Independent exact two-sided p by enumerating all 2^n sign patterns. */
function referenceP(ranks: number[], observedW: number): number {
    const totalRank = ranks.reduce((s, r) => s + r, 0);
    let extreme = 0;
    let count = 0;
    const enumerate = (i: number, plus: number): void => {
        if (i === ranks.length) {
            count += 1;
            if (Math.min(plus, totalRank - plus) <= observedW + 1e-9) extreme += 1;
            return;
        }
        enumerate(i + 1, plus + (ranks[i] ?? 0));
        enumerate(i + 1, plus);
    };
    enumerate(0, 0);
    return extreme / count;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Wilcoxon Signed-Rank Test", () => {
    it("matches brute-force W and exact p on several difference samples", () => {
        const cases: number[][] = [
            [-1, 2, -3, 4, -5, 6],
            [1, 2, 3, 4, 5, 6, 7, 8],
            [-2, -2, 3, 3, 3, -5],
            [0, 1, -1, 2, -2, 0, 4],
            [5, -5, 5, -5],
        ];
        for (const differences of cases) {
            const frames = [...mod.run({ differences })];
            const nonzero = differences.filter((d) => d !== 0);
            checkFrames(frames, nonzero.length);
            const final = frames.at(-1)?.meta;
            const ranks = referenceRanks(nonzero.map(Math.abs));
            let wp = 0;
            let wm = 0;
            nonzero.forEach((d, i) => {
                if (d > 0) wp += ranks[i] ?? 0;
                else wm += ranks[i] ?? 0;
            });
            const w = Math.min(wp, wm);
            expect(Number(final?.["wPlus"])).toBeCloseTo(wp, 9);
            expect(Number(final?.["wMinus"])).toBeCloseTo(wm, 9);
            expect(Number(final?.["w"])).toBeCloseTo(w, 9);
            expect(Number(final?.["pValue"])).toBeCloseTo(referenceP(ranks, w), 9);
        }
    });

    it("assigns average ranks to ties", () => {
        const frames = [...mod.run({ differences: [2, -2, 2, -2] })];
        const rankCells = frames[0]?.entities.filter((e) => e.metadata["row"] === 2) ?? [];
        const values = rankCells.map((e) => Number(e.value)).sort((a, b) => a - b);
        expect(values).toEqual([2.5, 2.5, 2.5, 2.5]);
    });

    it("gives a small p-value for a one-sided split", () => {
        const p = Number([...mod.run({ differences: [1, 2, 3, 4, 5, 6, 7, 8] })].at(-1)?.meta["pValue"]);
        expect(p).toBeLessThan(0.05);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
