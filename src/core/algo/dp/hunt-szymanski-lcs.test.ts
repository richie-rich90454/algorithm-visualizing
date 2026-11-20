/**
 * hunt-szymanski-lcs.test.ts - Brute-force LCS length check, subsequence
 * validity, frame-shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hunt-szymanski-lcs";
import type { VisualFrame } from "@/types";

/** Classic quadratic LCS DP used as an independent reference. */
function bruteLength(a: string, b: string): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
        Array<number>(b.length + 1).fill(0),
    );
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            dp[i]![j] = a[i - 1] === b[j - 1]
                ? (dp[i - 1]![j - 1] as number) + 1
                : Math.max(dp[i - 1]![j] as number, dp[i]![j - 1] as number);
        }
    }
    return dp[a.length]![b.length] as number;
}

function isSubsequence(sub: string, full: string): boolean {
    let cursor = 0;
    for (const ch of full) {
        if (cursor < sub.length && ch === sub[cursor]) {
            cursor += 1;
        }
    }
    return cursor === sub.length;
}

function checkFrames(frames: VisualFrame[], m: number, n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(m * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta.rows).toBe(m);
        expect(frame.meta.cols).toBe(n);
    });
}

describe("HuntSzymanskiLCS", () => {
    it("matches brute-force LCS length on random string pairs", () => {
        let seed = 999;
        const randChar = (alphabet: string): string => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return alphabet[seed % alphabet.length] as string;
        };
        const pairs: Array<[string, string]> = [
            ["ABCBDAB", "BDCABA"],
            ["ABCD", "DCBA"],
            ["", "ABC"],
            ["ABC", ""],
        ];
        for (const alphabet of ["AB", "ABCD"]) {
            for (let k = 0; k < 20; k += 1) {
                const lenA = (seed % 6) + 1;
                const lenB = (seed % 6) + 1;
                let a = "";
                let b = "";
                for (let x = 0; x < lenA; x += 1) a += randChar(alphabet);
                for (let x = 0; x < lenB; x += 1) b += randChar(alphabet);
                pairs.push([a, b]);
            }
        }
        for (const [a, b] of pairs) {
            const frames = [...mod.run({ a, b })];
            checkFrames(frames, a.length, b.length);
            const last = frames[frames.length - 1];
            const expected = bruteLength(a, b);
            expect(last?.meta.lcsLength).toBe(expected);
            expect((last?.meta.lcs as string).length).toBe(expected);
            expect(isSubsequence(last?.meta.lcs as string, a)).toBe(true);
            expect(isSubsequence(last?.meta.lcs as string, b)).toBe(true);
        }
    });

    it("threshold array is increasing and ends at the LCS length", () => {
        const input = mod.defaultInput as { a: string; b: string };
        const frames = [...mod.run(input)];
        const last = frames[frames.length - 1];
        const threshold = last?.meta.threshold as number[];
        for (let i = 1; i < threshold.length; i += 1) {
            expect(threshold[i] as number).toBeGreaterThan(threshold[i - 1] as number);
        }
        expect(threshold.length - 1).toBe(last?.meta.lcsLength);
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
