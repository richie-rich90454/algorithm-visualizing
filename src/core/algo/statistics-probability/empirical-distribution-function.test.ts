/**
 * empirical-distribution-function.test.ts - Independent ECDF reference,
 * monotonicity, known values, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./empirical-distribution-function";
import type { VisualFrame } from "@/types";

function reference(values: number[], queries: number[]): number[] {
    const n = values.length;
    return queries.map((q) => (n === 0 ? 0 : values.filter((v) => v <= q).length / n));
}

function checkFrames(frames: VisualFrame[], n: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("EmpiricalDistributionFunction", () => {
    it("matches an independent ECDF reference", () => {
        const values = [9, 1, 4, 2, 2, 7, 12];
        const queries = [-1, 1, 2, 3, 7, 12, 20];
        const frames = [...mod.run({ values, queries })];
        checkFrames(frames, values.length);
        const actual = frames[frames.length - 1].meta["results"] as number[];
        const expected = reference(values, queries);
        actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i] ?? 0, 10));
    });

    it("is monotone and bounded", () => {
        const values = [1, 3, 5, 7];
        const queries = [0, 1, 3, 5, 7, 8];
        const actual = [...mod.run({ values, queries })].at(-1)?.meta["results"] as number[];
        for (let i = 1; i < actual.length; i += 1) expect(actual[i] ?? 0).toBeGreaterThanOrEqual(actual[i - 1] ?? 0);
        expect(actual[0]).toBe(0);
        expect(actual[actual.length - 1]).toBe(1);
    });

    it("handles empty samples and a known textbook value", () => {
        expect(([...mod.run({ values: [], queries: [3] })].at(-1)?.meta["results"] as number[])[0]).toBe(0);
        const known = [...mod.run({ values: [1, 2, 2, 4, 7, 9], queries: [2, 5, 9] })].at(-1)?.meta["results"] as number[];
        expect(known[0]).toBeCloseTo(0.5, 10);
        expect(known[1]).toBeCloseTo(2 / 3, 10);
        expect(known[2]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBe(1 + 4 * (6 + 1) + 1);
        expect(generator.next().done).toBe(true);
    });
});
