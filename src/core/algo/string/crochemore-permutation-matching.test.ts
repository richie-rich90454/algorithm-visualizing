/**
 * crochemore-permutation-matching.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./crochemore-permutation-matching";
import type { VisualFrame } from "@/types";

/** Brute-force reference: a window matches when its sorted letters equal the sorted pattern. */
function bruteMatches(text: string, pattern: string): number[] {
    const m = pattern.length;
    if (m === 0 || m > text.length) {
        return [];
    }
    const sortedPattern = pattern.split("").sort().join("");
    const out: number[] = [];
    for (let i = 0; i <= text.length - m; i += 1) {
        if (text.slice(i, i + m).split("").sort().join("") === sortedPattern) {
            out.push(i);
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[], textLength: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(textLength);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Crochemore Permutation Matching", () => {
    it("matches brute force on the default input", () => {
        const input = mod.defaultInput as { text: string; pattern: string };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.text.length);
        const expected = bruteMatches(input.text, input.pattern);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["matches"]).toEqual(expected);
        expect(finalMeta?.["matchCount"]).toBe(expected.length);
    });

    it("matches brute force on randomized inputs", () => {
        const alphabet = "abc";
        let seed = 7;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 60; t += 1) {
            const text = Array.from({ length: 2 + (rand() % 12) }, () => alphabet[rand() % alphabet.length]).join("");
            const pattern = Array.from({ length: 1 + (rand() % 4) }, () => alphabet[rand() % alphabet.length]).join("");
            const frames = [...mod.run({ text, pattern })];
            checkFrames(frames, text.length);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["matches"]).toEqual(bruteMatches(text, pattern));
        }
    });

    it("handles empty and over-long patterns", () => {
        for (const pattern of ["", "abcdefghij"]) {
            const frames = [...mod.run({ text: "abc", pattern })];
            checkFrames(frames, 3);
            expect(frames[frames.length - 1]?.meta["matches"]).toEqual([]);
        }
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
