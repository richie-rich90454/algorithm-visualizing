/**
 * four-russians.test.ts - Brute-force LCS and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import mod, { buildBlockTable, lcsFourRussians, tableSize } from "./four-russians";
import type { VisualFrame } from "@/types";

function naiveLcs(a: string, b: string): number {
    const prev = new Array<number>(b.length + 1).fill(0);
    for (let i = 1; i <= a.length; i += 1) {
        const cur = new Array<number>(b.length + 1).fill(0);
        for (let j = 1; j <= b.length; j += 1) {
            cur[j] = a[i - 1] === b[j - 1]
                ? prev[j - 1]! + 1
                : Math.max(prev[j]!, cur[j - 1]!);
        }
        for (let j = 0; j <= b.length; j += 1) {
            prev[j] = cur[j]!;
        }
    }
    return prev[b.length] ?? 0;
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Four Russians LCS", () => {
    it("builds a complete transition table", () => {
        expect(tableSize(4)).toBe(16 * 32);
        const table = buildBlockTable(4);
        expect(table.length).toBe(512);
        expect(Array.from(table).every((v) => Number.isInteger(v) && v >= 0 && v < 32)).toBe(true);
    });

    it("matches brute-force LCS on many random pairs", () => {
        let seed = 987654;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        const alphabet = "abc";
        for (let trial = 0; trial < 250; trial += 1) {
            const la = rand() % 18;
            const lb = rand() % 18;
            let a = "";
            let b = "";
            for (let i = 0; i < la; i += 1) a += alphabet[rand() % 3];
            for (let i = 0; i < lb; i += 1) b += alphabet[rand() % 3];
            expect(lcsFourRussians(a, b, 4).length).toBe(naiveLcs(a, b));
        }
    });

    it("handles empty strings and edge cases", () => {
        expect(lcsFourRussians("", "abc").length).toBe(0);
        expect(lcsFourRussians("abc", "").length).toBe(0);
        expect(lcsFourRussians("", "").length).toBe(0);
        expect(lcsFourRussians("abc", "abc").length).toBe(3);
        expect(lcsFourRussians("abc", "xyz").length).toBe(0);
    });

    it("produces row prefixes equal to the reference DP", () => {
        const a = "abcbdab";
        const b = "bdcaba";
        const result = lcsFourRussians(a, b);
        const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
        for (let i = 1; i <= a.length; i += 1) {
            for (let j = 1; j <= b.length; j += 1) {
                dp[i]![j] = a[i - 1] === b[j - 1]
                    ? dp[i - 1]![j - 1]! + 1
                    : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
            }
        }
        for (let i = 0; i <= a.length; i += 1) {
            expect(result.rowLengths[i]).toBe(dp[i]![b.length]);
        }
    });

    it("produces well-formed frames and terminates", () => {
        const input = mod.defaultInput as { a: string; b: string };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.a.length + 1, input.b.length + 1);
        const final = frames[frames.length - 1]?.meta as { lcs: number; done: boolean };
        expect(final.done).toBe(true);
        expect(final.lcs).toBe(naiveLcs(input.a, input.b));
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
