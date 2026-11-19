/**
 * trie-autocomplete.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./trie-autocomplete";
import type { VisualFrame } from "@/types";

function brute(words: string[], prefix: string, frequencies: Record<string, number>) {
    return words
        .filter((w) => w.startsWith(prefix))
        .map((word) => ({ word, score: frequencies[word] ?? 1 }))
        .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Trie Autocomplete", () => {
    it("returns the correct ranked completions on the default input", () => {
        const input = mod.defaultInput as { words: string[]; prefix: string; frequencies: Record<string, number> };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = brute(input.words, input.prefix, input.frequencies);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(finalMeta?.["suggestions"]).toEqual(expected.map((e) => e.word));
        expect(finalMeta?.["suggestionCounts"]).toEqual(expected.map((e) => e.score));
    });

    it("matches brute force on randomized word sets", () => {
        const alphabet = "abc";
        let seed = 67;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let t = 0; t < 50; t += 1) {
            const words = Array.from({ length: 1 + (rand() % 12) }, () =>
                Array.from({ length: 1 + (rand() % 4) }, () => alphabet[rand() % alphabet.length]).join(""),
            );
            const prefix = alphabet[rand() % alphabet.length] as string;
            const frequencies: Record<string, number> = {};
            for (const word of words) {
                frequencies[word] = rand() % 6;
            }
            const frames = [...mod.run({ words, prefix, frequencies })];
            checkFrames(frames);
            const expected = brute([...new Set(words)], prefix, frequencies);
            const finalMeta = frames[frames.length - 1]?.meta;
            expect(finalMeta?.["suggestions"]).toEqual(expected.map((e) => e.word));
            expect(finalMeta?.["suggestionCounts"]).toEqual(expected.map((e) => e.score));
        }
    });

    it("handles a missing prefix", () => {
        const frames = [...mod.run({ words: ["cat", "car"], prefix: "z", frequencies: {} })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["suggestions"]).toEqual([]);
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
