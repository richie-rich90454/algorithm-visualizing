/**
 * difference-in-differences.test.ts - Brute-force recomputation and invariance checks.
 */

import { describe, expect, it } from "vitest";
import mod, { differenceInDifferences } from "./difference-in-differences";
import type { VisualFrame } from "@/types";

/** Straightforward independent recomputation from raw arrays. */
function bruteForce(tp: number[], tq: number[], cp: number[], cq: number[]) {
    const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    const tc = tq.map((v, i) => v - tp[i]);
    const cc = cq.map((v, i) => v - cp[i]);
    const tChange = avg(tc);
    const cChange = avg(cc);
    const varOf = (xs: number[]) => {
        const m = avg(xs);
        return xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1);
    };
    const se = Math.sqrt(varOf(tc) / tc.length + varOf(cc) / cc.length);
    return {
        did: tChange - cChange,
        tChange,
        cChange,
        se,
        t: (tChange - cChange) / se,
    };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(5);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(2);
    });
}

describe("Difference in Differences", () => {
    it("matches an independent recomputation on several datasets", () => {
        const cases: Array<[number[], number[], number[], number[]]> = [
            [[10, 12, 11, 13], [20, 23, 21, 25], [10, 11, 12, 11], [14, 16, 15, 16]],
            [[5, 7, 9], [8, 9, 14], [4, 6, 8], [5, 8, 9]],
            [[1, 2, 3, 4, 5], [3, 5, 7, 9, 11], [2, 3, 4, 5, 6], [2, 4, 6, 8, 10]],
        ];
        for (const [tp, tq, cp, cq] of cases) {
            const result = differenceInDifferences(tp, tq, cp, cq);
            const expected = bruteForce(tp, tq, cp, cq);
            expect(result.did).toBeCloseTo(expected.did, 10);
            expect(result.treatedChange).toBeCloseTo(expected.tChange, 10);
            expect(result.controlChange).toBeCloseTo(expected.cChange, 10);
            expect(result.standardError).toBeCloseTo(expected.se, 10);
            expect(result.tStatistic).toBeCloseTo(expected.t, 10);
        }
    });

    it("is invariant to adding a common constant and identifies a known effect", () => {
        const tp = [10, 12, 11];
        const tq = [18, 21, 19];
        const cp = [9, 10, 11];
        const cq = [12, 14, 13];
        const base = differenceInDifferences(tp, tq, cp, cq);
        const shifted = differenceInDifferences(
            tp.map((v) => v + 100),
            tq.map((v) => v + 100),
            cp.map((v) => v + 100),
            cq.map((v) => v + 100),
        );
        expect(shifted.did).toBeCloseTo(base.did, 10);
        expect(shifted.standardError).toBeCloseTo(base.standardError, 10);

        const exact = differenceInDifferences([10, 10], [20, 20], [5, 5], [9, 9]);
        expect(exact.did).toBeCloseTo(6, 10);
        expect(exact.standardError).toBe(0);
        expect(exact.tStatistic).toBe(0);
    });

    it("reports all four means and the estimator in frames", () => {
        const input = mod.defaultInput as {
            treatedPre: number[];
            treatedPost: number[];
            controlPre: number[];
            controlPost: number[];
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = differenceInDifferences(
            input.treatedPre,
            input.treatedPost,
            input.controlPre,
            input.controlPost,
        );
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["did"])).toBeCloseTo(expected.did, 10);
        expect(Number(final?.["treatedChange"])).toBeCloseTo(expected.treatedChange, 10);
        expect(Number(final?.["controlChange"])).toBeCloseTo(expected.controlChange, 10);
        expect(Number(final?.["standardError"])).toBeCloseTo(expected.standardError, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
