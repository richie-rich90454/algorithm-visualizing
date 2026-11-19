/**
 * galil-seiferas.test.ts - Brute-force matching and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import mod, { galilSeiferas, kmpOccurrences, minimalPeriod, prefixFunction } from "./galil-seiferas";
import type { VisualFrame } from "@/types";

function naive(text: string, pattern: string): number[] {
    const out: number[] = [];
    for (let i = 0; i + pattern.length <= text.length; i += 1) {
        let ok = true;
        for (let j = 0; j < pattern.length; j += 1) {
            if (text[i + j] !== pattern[j]) {
                ok = false;
                break;
            }
        }
        if (ok) {
            out.push(i);
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Galil-Seiferas string matching", () => {
    it("computes prefix functions and minimal periods", () => {
        expect(prefixFunction("ababab")).toEqual([0, 0, 1, 2, 3, 4]);
        expect(prefixFunction("aaaa")).toEqual([0, 1, 2, 3]);
        expect(minimalPeriod("ababab")).toBe(2);
        expect(minimalPeriod("aaaa")).toBe(1);
        expect(minimalPeriod("abcde")).toBe(5);
    });

    it("matches brute-force search on many random cases", () => {
        let seed = 12345;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        const alphabet = "ab";
        for (let trial = 0; trial < 300; trial += 1) {
            const n = 1 + (rand() % 30);
            const m = 1 + (rand() % 8);
            let text = "";
            let pattern = "";
            for (let i = 0; i < n; i += 1) text += alphabet[rand() % 2];
            for (let i = 0; i < m; i += 1) pattern += alphabet[rand() % 2];
            const expected = naive(text, pattern);
            expect(galilSeiferas(text, pattern).matches).toEqual(expected);
            expect(kmpOccurrences(text, pattern)).toEqual(expected);
        }
    });

    it("handles overlapping and periodic matches", () => {
        expect(galilSeiferas("aaaaa", "aa").matches).toEqual([0, 1, 2, 3]);
        expect(galilSeiferas("abcabcabc", "abcabc").matches).toEqual([0, 3]);
        expect(galilSeiferas("abababab", "ababab").matches).toEqual([0, 2]);
        expect(galilSeiferas("abc", "abcd").matches).toEqual([]);
    });

    it("produces well-formed frames with a correct final answer", () => {
        const input = mod.defaultInput as { text: string; pattern: string };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.text.length);
        const final = frames[frames.length - 1]?.meta as { matches: number[]; done: boolean };
        expect(final.done).toBe(true);
        expect(final.matches).toEqual(naive(input.text, input.pattern));
    });

    it("terminates cleanly with edge cases", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
        expect([...mod.run({ text: "abc", pattern: "" })].length).toBeGreaterThan(1);
    });
});
