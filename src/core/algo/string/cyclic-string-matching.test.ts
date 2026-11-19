/**
 * cyclic-string-matching.test.ts - Independent doubled-text check, frame
 * shape, and termination for circular string matching.
 */

import { describe, expect, it } from "vitest";
import mod from "./cyclic-string-matching";

/** Independent check: search the pattern in a sufficiently repeated text. */
function bruteCyclicMatches(text: string, pattern: string): number[] {
    const n = text.length;
    if (n === 0 || pattern.length === 0) {
        return [];
    }
    const copies = Math.ceil(pattern.length / n) + 1;
    const doubled = text.repeat(copies);
    const result: number[] = [];
    for (let start = 0; start < n; start += 1) {
        if (doubled.startsWith(pattern, start)) {
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

describe("Cyclic String Matching", () => {
    it("matches the doubled-text reference on the default input", () => {
        const input = mod.defaultInput as { text: string; pattern: string };
        const frames = [...mod.run(input)];
        const last = frames[frames.length - 1];
        expect(last?.meta.matches).toEqual(bruteCyclicMatches(input.text, input.pattern));
        expect(last?.meta.wrapped).toBe(1);
    });

    it("agrees with the doubled-text reference on random inputs", () => {
        const random = seeded(556677);
        for (let trial = 0; trial < 100; trial += 1) {
            const text = randomString(1 + Math.floor(random() * 12), "abc", random);
            const pattern = randomString(1 + Math.floor(random() * 5), "abc", random);
            const expected = bruteCyclicMatches(text, pattern);
            const frames = [...mod.run({ text, pattern })];
            const last = frames[frames.length - 1];
            expect(last?.meta.matches, `trial ${trial}: ${text} / ${pattern}`).toEqual(expected);
        }
    });

    it("reports a wrapping occurrence explicitly", () => {
        const frames = [...mod.run({ text: "abcabc", pattern: "cabc" })];
        const last = frames[frames.length - 1];
        expect(last?.meta.matches).toContain(5);
        expect(last?.meta.wrapped).toBeGreaterThanOrEqual(1);
    });

    it("every frame is well formed and the generator terminates", () => {
        const input = mod.defaultInput as { text: string; pattern: string };
        const frames = [...mod.run(input)];
        expect(frames).toHaveLength(input.text.length + 2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(typeof frame.description).toBe("string");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber as number).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber as number).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("text");
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.size).toBe(frame.entities.length);
            for (const e of frame.entities) {
                expect(e.type).toBe("character");
                expect(Number.isFinite(e.x)).toBe(true);
                expect(Number.isFinite(e.y)).toBe(true);
            }
        });
    });

    it("handles empty text and empty pattern", () => {
        const emptyText = [...mod.run({ text: "", pattern: "abc" })];
        expect(emptyText[emptyText.length - 1]?.meta.matches).toEqual([]);
        const emptyPattern = [...mod.run({ text: "abc", pattern: "" })];
        expect(emptyPattern[emptyPattern.length - 1]?.meta.matches).toEqual([0, 1, 2]);
    });
});
