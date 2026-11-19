/**
 * cohens-kappa.test.ts - Independent contingency-table computation, known
 * textbook value, perfect agreement, rater symmetry, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cohens-kappa";
import type { VisualFrame } from "@/types";

type Pair = [number, number];

function checkFrames(frames: VisualFrame[], ratings: Pair[], k: number): void {
    expect(frames.length).toBe(ratings.length + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(k * k);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Reference kappa rebuilt directly from the rating pairs. */
function reference(ratings: Pair[], k: number): { po: number; pe: number; kappa: number } {
    const table = Array.from({ length: k }, () => Array<number>(k).fill(0));
    for (const [a, b] of ratings) {
        table[a][b] += 1;
    }
    const N = ratings.length;
    let diagonal = 0;
    for (let i = 0; i < k; i += 1) {
        diagonal += table[i][i];
    }
    const po = diagonal / N;
    let pe = 0;
    for (let i = 0; i < k; i += 1) {
        const row = table[i].reduce((s, v) => s + v, 0) / N;
        const col = table.reduce((s, rowValues) => s + rowValues[i], 0) / N;
        pe += row * col;
    }
    const denom = 1 - pe;
    return { po, pe, kappa: Math.abs(denom) < 1e-12 ? (po >= 1 ? 1 : 0) : (po - pe) / denom };
}

describe("CohensKappa", () => {
    it("matches an independent table computation", () => {
        const ratings: Pair[] = [
            [0, 0], [0, 1], [0, 2], [1, 1], [1, 1], [2, 2], [2, 0], [1, 2], [0, 0], [2, 2],
        ];
        const frames = [...mod.run({ ratings, categories: 3 })];
        checkFrames(frames, ratings, 3);
        const expected = reference(ratings, 3);
        const final = frames[frames.length - 1];
        expect(Number(final.meta["po"])).toBeCloseTo(expected.po, 10);
        expect(Number(final.meta["pe"])).toBeCloseTo(expected.pe, 10);
        expect(Number(final.meta["kappa"])).toBeCloseTo(expected.kappa, 10);
    });

    it("reproduces the classic two-by-two example", () => {
        const ratings: Pair[] = [
            ...Array.from({ length: 4 }, () => [0, 0] as Pair),
            ...Array.from({ length: 2 }, () => [0, 1] as Pair),
            ...Array.from({ length: 3 }, () => [1, 0] as Pair),
            ...Array.from({ length: 11 }, () => [1, 1] as Pair),
        ];
        const final = [...mod.run({ ratings, categories: 2 })].at(-1);
        expect(Number(final?.meta["kappa"])).toBeCloseTo(0.4318, 3);
    });

    it("gives one for perfect agreement and is symmetric under rater swap", () => {
        const perfect: Pair[] = [[0, 0], [1, 1], [2, 2], [0, 0], [2, 2]];
        expect(Number([...mod.run({ ratings: perfect, categories: 3 })].at(-1)?.meta["kappa"])).toBeCloseTo(1, 10);
        const mixed: Pair[] = [[0, 1], [1, 2], [2, 0], [1, 0], [0, 2], [2, 1]];
        const swapped: Pair[] = mixed.map(([a, b]) => [b, a]);
        const k1 = Number([...mod.run({ ratings: mixed, categories: 3 })].at(-1)?.meta["kappa"]);
        const k2 = Number([...mod.run({ ratings: swapped, categories: 3 })].at(-1)?.meta["kappa"]);
        expect(k2).toBeCloseTo(k1, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(22);
        expect(generator.next().done).toBe(true);
    });
});
