/**
 * cohens-d.test.ts - Independent pooled-variance computation, known value,
 * symmetry, zero-effect case, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./cohens-d";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeTypeOf("object");
    });
}

function reference(g1: number[], g2: number[]): { m1: number; m2: number; pooledVariance: number; d: number } {
    const avg = (xs: number[]): number => xs.reduce((s, v) => s + v, 0) / xs.length;
    const m1 = avg(g1);
    const m2 = avg(g2);
    let ss = 0;
    for (const v of g1) {
        ss += (v - m1) ** 2;
    }
    for (const v of g2) {
        ss += (v - m2) ** 2;
    }
    const pooledVariance = ss / (g1.length + g2.length - 2);
    const sd = Math.sqrt(pooledVariance);
    return { m1, m2, pooledVariance, d: sd > 0 ? (m1 - m2) / sd : 0 };
}

describe("CohensD", () => {
    it("matches an independent pooled-variance computation", () => {
        const group1 = [3, 7, 2, 9, 5];
        const group2 = [8, 4, 6, 11, 2, 7];
        const frames = [...mod.run({ group1, group2 })];
        checkFrames(frames, group1.length + group2.length);
        const expected = reference(group1, group2);
        const final = frames[frames.length - 1];
        expect(Number(final.meta["m1"])).toBeCloseTo(expected.m1, 12);
        expect(Number(final.meta["m2"])).toBeCloseTo(expected.m2, 12);
        expect(Number(final.meta["pooledVariance"])).toBeCloseTo(expected.pooledVariance, 12);
        expect(Number(final.meta["d"])).toBeCloseTo(expected.d, 12);
    });

    it("reproduces the textbook example", () => {
        const final = [...mod.run({ group1: [1, 2, 3, 4], group2: [5, 6, 7, 8] })].at(-1);
        expect(Number(final?.meta["d"])).toBeCloseTo(-3.0984, 3);
    });

    it("negates under group swap and vanishes for equal groups", () => {
        const a = [1, 4, 2, 6];
        const b = [9, 7, 11, 8];
        const d1 = Number([...mod.run({ group1: a, group2: b })].at(-1)?.meta["d"]);
        const d2 = Number([...mod.run({ group1: b, group2: a })].at(-1)?.meta["d"]);
        expect(d2).toBeCloseTo(-d1, 12);
        const zero = Number([...mod.run({ group1: a, group2: a })].at(-1)?.meta["d"]);
        expect(zero).toBeCloseTo(0, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(11);
        expect(generator.next().done).toBe(true);
    });
});
