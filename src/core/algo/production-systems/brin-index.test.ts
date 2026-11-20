/** brin-index.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./brin-index";
import type { VisualFrame } from "@/types";

type Query = { column: number; low: number; high: number };

/** Independent brute-force scan used as the reference answer. */
function bruteForce(rows: number[][], query: Query): number[] {
    const result: number[] = [];
    rows.forEach((row, index) => {
        const value = row[query.column] ?? 0;
        if (value >= query.low && value <= query.high) result.push(index);
    });
    return result;
}

/** Check that a frame sequence is well formed. */
function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Block Range Index (BRIN)", () => {
    it("matches a brute-force scan on the default input", () => {
        const input = mod.defaultInput as { rows: number[][]; query: Query; pagesPerRange: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.rows.length);
        const final = frames[frames.length - 1];
        expect(final?.meta["resultIds"]).toEqual(bruteForce(input.rows, input.query));
    });

    it("never prunes a range that contains a matching row", () => {
        let seed = 9876;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % 200;
        };
        for (let trial = 0; trial < 25; trial += 1) {
            const rows = Array.from({ length: 30 }, () => [next(), next()]);
            const query: Query = { column: trial % 2, low: 40, high: 150 };
            const pagesPerRange = 2 + (trial % 6);
            const frames = [...mod.run({ rows, query, pagesPerRange })];
            checkFrames(frames, rows.length);
            const final = frames[frames.length - 1];
            expect(final?.meta["resultIds"]).toEqual(bruteForce(rows, query));
            const summaries = final?.meta["rangeSummaries"] as number[][] | undefined;
            expect(summaries?.length).toBe(Math.ceil(rows.length / pagesPerRange));
            for (let r = 0; r < (summaries?.length ?? 0); r += 1) {
                const summary = summaries?.[r] as number[];
                const start = r * pagesPerRange;
                const end = Math.min(start + pagesPerRange, rows.length) - 1;
                let min = Number.POSITIVE_INFINITY;
                let max = Number.NEGATIVE_INFINITY;
                for (let i = start; i <= end; i += 1) {
                    const value = rows[i]?.[query.column] ?? 0;
                    min = Math.min(min, value);
                    max = Math.max(max, value);
                }
                expect(summary[0]).toBe(min);
                expect(summary[1]).toBe(max);
                const hasMatch = Array.from({ length: end - start + 1 }, (_, k) => rows[start + k]?.[query.column] ?? 0).some(
                    (value) => value >= query.low && value <= query.high,
                );
                if (hasMatch) expect(max >= query.low && min <= query.high).toBe(true);
            }
        }
    });

    it("handles empty rows and empty queries", () => {
        const frames = [...mod.run({ rows: [], query: { column: 0, low: 0, high: 10 }, pagesPerRange: 4 })];
        checkFrames(frames, 0);
        expect(frames[frames.length - 1]?.meta["resultIds"]).toEqual([]);
        const none = [...mod.run({ rows: [[1, 2], [3, 4]], query: { column: 0, low: 100, high: 200 }, pagesPerRange: 3 })];
        checkFrames(none, 2);
        expect(none[none.length - 1]?.meta["resultIds"]).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
