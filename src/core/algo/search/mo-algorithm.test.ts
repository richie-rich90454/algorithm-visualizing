/** mo-algorithm.test.ts - Brute-force range-query cross-check, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./mo-algorithm";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities).toHaveLength(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.meta["block"]).toBeDefined();
        expect(Array.isArray(frame.meta["answers"])).toBe(true);
    });
}

describe("Mo's Algorithm", () => {
    it("matches a brute-force distinct-count check on random queries", () => {
        let seed = 7;
        const rand = (limit: number): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % limit;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const n = 1 + rand(14);
            const values = Array.from({ length: n }, () => rand(7) - 3);
            const q = 1 + rand(10);
            const queries = Array.from({ length: q }, () => {
                const a = rand(n);
                const b = rand(n);
                return [a, b];
            });
            const frames = [...mod.run({ values, queries })];
            checkFrames(frames, n);
            const answers = frames[frames.length - 1]?.meta["answers"] as number[];
            expect(answers).toHaveLength(q);
            queries.forEach((query, index) => {
                const lo = Math.min(query[0], query[1]);
                const hi = Math.max(query[0], query[1]);
                const expected = new Set(values.slice(lo, hi + 1)).size;
                expect(answers[index]).toBe(expected);
            });
        }
    });

    it("handles empty inputs and out-of-range queries", () => {
        const empty = [...mod.run({ values: [], queries: [[0, 3]] })];
        checkFrames(empty, 0);
        expect(empty[empty.length - 1]?.meta["answers"]).toEqual([0]);

        const clamped = [...mod.run({ values: [5, 5, 5], queries: [[-4, 99]] })];
        const answers = clamped[clamped.length - 1]?.meta["answers"] as number[];
        expect(answers[0]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
