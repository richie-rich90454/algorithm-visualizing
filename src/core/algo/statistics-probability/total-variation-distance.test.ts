/**
 * total-variation-distance.test.ts - Independent distance computation,
 * symmetry, identity and disjoint-support extremes, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./total-variation-distance";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2 * n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeTypeOf("object");
    });
}

function reference(p: number[], q: number[]): number {
    const norm = (xs: number[]): number[] => {
        const t = xs.reduce((s, v) => s + Math.max(0, v), 0);
        return t > 0 ? xs.map((v) => Math.max(0, v) / t) : xs.map(() => 0);
    };
    const pn = norm(p);
    const qn = norm(q);
    return pn.reduce((sum, value, i) => sum + Math.abs(value - (qn[i] ?? 0)), 0) / 2;
}

describe("TotalVariationDistance", () => {
    it("matches an independent distance computation", () => {
        const p = [0.5, 0.25, 0.15, 0.1];
        const q = [0.1, 0.35, 0.3, 0.25];
        const frames = [...mod.run({ p, q })];
        checkFrames(frames, p.length);
        expect(Number(frames[frames.length - 1].meta["distance"])).toBeCloseTo(reference(p, q), 12);
    });

    it("is zero for identical distributions and one for disjoint support", () => {
        const same = [...mod.run({ p: [1, 2, 3], q: [1, 2, 3] })].at(-1);
        expect(Number(same?.meta["distance"])).toBeCloseTo(0, 12);
        const disjoint = [...mod.run({ p: [1, 1, 0], q: [0, 0, 2] })].at(-1);
        expect(Number(disjoint?.meta["distance"])).toBeCloseTo(1, 12);
    });

    it("is symmetric under swapping the two distributions", () => {
        const p = [0.6, 0.3, 0.1];
        const q = [0.2, 0.2, 0.6];
        const d1 = Number([...mod.run({ p, q })].at(-1)?.meta["distance"]);
        const d2 = Number([...mod.run({ p: q, q: p })].at(-1)?.meta["distance"]);
        expect(d2).toBeCloseTo(d1, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
