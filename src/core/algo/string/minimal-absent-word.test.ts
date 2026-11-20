/**
 * minimal-absent-word.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./minimal-absent-word";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Brute-force search for the lexicographically smallest shortest absent word. */
function bruteForce(text: string, alphabet: string[]): string {
    for (let length = 1; length <= text.length + 1; length += 1) {
        let words: string[] = [""];
        for (let k = 0; k < length; k += 1) {
            const next: string[] = [];
            for (const word of words) {
                for (const ch of alphabet) {
                    next.push(word + ch);
                }
            }
            words = next;
        }
        for (const word of words) {
            if (!text.includes(word)) {
                return word;
            }
        }
    }
    return "";
}

describe("Shortest absent word", () => {
    it("matches brute-force enumeration on small inputs", () => {
        const cases = [
            { text: "abab", alphabet: "ab" },
            { text: "abcab", alphabet: "abc" },
            { text: "aaaa", alphabet: "ab" },
            { text: "banana", alphabet: "abn" },
            { text: "ab", alphabet: "abc" },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const alphabet = [...new Set(input.alphabet.split(""))].sort();
            const answer = final["answer"] as string;
            expect(answer).toBe(bruteForce(input.text, alphabet));
            expect(input.text.includes(answer)).toBe(false);
            expect(final["answerLength"]).toBe(answer.length);
        }
    });

    it("accepts only a word whose shorter candidates are all present", () => {
        const input = { text: "abab", alphabet: "ab" };
        const frames = [...mod.run(input)];
        const answer = frames[frames.length - 1]!.meta["answer"] as string;
        expect(answer).toBe("aa");
        for (const shorter of ["a", "b"]) {
            expect(input.text.includes(shorter)).toBe(true);
        }
        const testFrames = frames.slice(1, -1);
        const candidates = testFrames.map((frame) => frame.meta["candidate"] as string);
        expect(candidates).toContain("a");
        expect(candidates).toContain("b");
        expect(candidates[candidates.length - 1]).toBe("aa");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
