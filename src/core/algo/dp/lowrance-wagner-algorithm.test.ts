/**
 * lowrance-wagner-algorithm.test.ts - Brute-force SCS length check, subsequence
 * validity, frame-shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lowrance-wagner-algorithm";
import type { VisualFrame } from "@/types";

function isSubsequence(sub: string, full: string): boolean {
    let cursor = 0;
    for (const ch of full) {
        if (cursor < sub.length && ch === sub[cursor]) cursor += 1;
    }
    return cursor === sub.length;
}

/** Enumerate every string over the alphabet to find the true shortest length. */
function bruteSCSLength(strings: string[], alphabet: string[], maxLength: number): number {
    const containsAll = (candidate: string): boolean =>
        strings.every((s) => isSubsequence(s, candidate));

    let current = [""];
    for (let length = 0; length <= maxLength; length += 1) {
        if (current.some(containsAll)) {
            return length;
        }
        const next: string[] = [];
        for (const prefix of current) {
            for (const ch of alphabet) {
                next.push(prefix + ch);
            }
        }
        current = next;
    }
    return -1;
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta.rows).toBe(rows);
        expect(frame.meta.cols).toBe(cols);
    });
}

describe("LowranceWagnerAlgorithm", () => {
    it("matches brute-force enumeration on small alphabets", () => {
        const cases: string[][] = [
            ["ab", "ba"],
            ["a", "b", "a"],
            ["ab", "ba", "aba"],
            ["aab", "aba", "baa"],
            ["abab", "baba"],
            ["abc", "bca", "cab"],
        ];
        for (const strings of cases) {
            const frames = [...mod.run({ strings })];
            const cols = Math.max(...strings.map((s) => s.length));
            checkFrames(frames, strings.length, cols);
            const last = frames[frames.length - 1];
            const scs = last?.meta.scs as string;
            const alphabet = Array.from(new Set(strings.join("").split(""))).sort();
            const expected = bruteSCSLength(strings, alphabet, scs.length);
            expect(expected).toBe(scs.length);
            expect(strings.every((s) => isSubsequence(s, scs))).toBe(true);
            expect(last?.meta.length).toBe(scs.length);
        }
    });

    it("returns the single string itself for one input", () => {
        const frames = [...mod.run({ strings: ["abcab"] })];
        expect(frames[frames.length - 1]?.meta.scs).toBe("abcab");
        expect(frames[frames.length - 1]?.meta.length).toBe(5);
    });

    it("handles empty strings and terminates cleanly", () => {
        const empties = [...mod.run({ strings: ["", ""] })];
        expect(empties[empties.length - 1]?.meta.scs).toBe("");
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
