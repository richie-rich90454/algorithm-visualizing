/**
 * parameterized-matching.test.ts - Independent equality-pattern check,
 * frame shape, and termination for parameterized matching.
 */

import { describe, expect, it } from "vitest";
import mod from "./parameterized-matching";

/** Independent characterization: a one-to-one renaming preserves equality. */
function pMatch(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < a.length; j += 1) {
            if ((a[i] === a[j]) !== (b[i] === b[j])) {
                return false;
            }
        }
    }
    return true;
}

function bruteMatches(text: string, pattern: string): number[] {
    const result: number[] = [];
    for (let start = 0; start + pattern.length <= text.length; start += 1) {
        if (pMatch(pattern, text.slice(start, start + pattern.length))) {
            result.push(start);
        }
    }
    return result;
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function randomString(length: number, alphabet: string, random: () => number): string {
    let out = "";
    for (let i = 0; i < length; i += 1) {
        out += alphabet[Math.floor(random() * alphabet.length)];
    }
    return out;
}

describe("Parameterized Matching", () => {
    it("matches the brute-force equality pattern on the default input", () => {
        const input = mod.defaultInput as { text: string; pattern: string };
        const frames = [...mod.run(input)];
        const last = frames[frames.length - 1];
        expect(last?.meta.matches).toEqual(bruteMatches(input.text, input.pattern));
    });

    it("agrees with brute force over random strings and small alphabets", () => {
        const random = seeded(441022);
        for (let trial = 0; trial < 120; trial += 1) {
            const text = randomString(1 + Math.floor(random() * 14), "abcd", random);
            const pattern = randomString(1 + Math.floor(random() * 5), "abcd", random);
            const expected = bruteMatches(text, pattern);
            const frames = [...mod.run({ text, pattern })];
            const last = frames[frames.length - 1];
            expect(last?.meta.matches, `trial ${trial}: ${text} / ${pattern}`).toEqual(expected);
        }
    });

    it("rejects equal-length strings that are not renamings", () => {
        expect(pMatch("aa", "ab")).toBe(false);
        expect(pMatch("ab", "ba")).toBe(true);
        expect(pMatch("abca", "wxyw")).toBe(true);
        const renamed = [...mod.run({ text: "xxy", pattern: "ab" })];
        expect(renamed[renamed.length - 1]?.meta.matches).toEqual([1]);
        const notRenaming = [...mod.run({ text: "abc", pattern: "aa" })];
        expect(notRenaming[notRenaming.length - 1]?.meta.matches).toEqual([]);
    });

    it("every frame is well formed and the generator terminates", () => {
        const input = mod.defaultInput as { text: string; pattern: string };
        const frames = [...mod.run(input)];
        expect(frames).toHaveLength(input.text.length - input.pattern.length + 3);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(typeof frame.description).toBe("string");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber as number).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber as number).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("text");
            expect(Array.isArray(frame.meta.patternEncoding)).toBe(true);
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.size).toBe(frame.entities.length);
            for (const e of frame.entities) {
                expect(e.type).toBe("character");
                expect(Number.isFinite(e.x)).toBe(true);
                expect(Number.isFinite(e.y)).toBe(true);
            }
        });
    });

    it("handles empty pattern and empty text", () => {
        const emptyPattern = [...mod.run({ text: "abc", pattern: "" })];
        expect(emptyPattern[emptyPattern.length - 1]?.meta.matches).toEqual([0, 1, 2, 3]);
        const emptyText = [...mod.run({ text: "", pattern: "a" })];
        expect(emptyText[emptyText.length - 1]?.meta.matches).toEqual([]);
        expect(emptyText[emptyText.length - 1]?.description.length).toBeGreaterThanOrEqual(10);
    });
});
