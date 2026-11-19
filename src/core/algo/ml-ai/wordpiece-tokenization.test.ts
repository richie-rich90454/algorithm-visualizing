/**
 * wordpiece-tokenization.test.ts - Brute-force greedy reference, reconstruction, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { wordPieceTokenize } from "./wordpiece-tokenization";
import type { VisualFrame } from "@/types";

const DEFAULT_VOCAB = [
    "play", "un", "hug", "happy", "##ing", "##er", "##y", "##p", "##n", "##g",
    "##a", "##e", "##i", "##h", "##u", "##l", "##o", "##r", "##s", "##t",
    ..."abcdefghijklmnopqrstuvwxyz".split(""),
    "[UNK]",
];

/** Independent greedy reference written directly against the vocabulary array. */
function reference(word: string, vocab: string[]): string[] {
    const tokens: string[] = [];
    let at = 0;
    while (at < word.length) {
        let found: string | undefined;
        let foundLen = 0;
        for (let length = word.length - at; length >= 1; length -= 1) {
            const piece = word.substring(at, at + length);
            const key = at === 0 ? piece : "##" + piece;
            if (vocab.indexOf(key) !== -1) {
                found = key;
                foundLen = length;
                break;
            }
        }
        if (found !== undefined) {
            tokens.push(found);
            at += foundLen;
        } else {
            tokens.push("[UNK]");
            at += 1;
        }
    }
    return tokens;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("WordPiece Tokenization", () => {
    it("matches an independent greedy reference on many words", () => {
        const vocab = new Set(DEFAULT_VOCAB);
        for (const word of ["playing", "player", "unhappy", "hugging", "zebra", "a", "xyzq"]) {
            expect(wordPieceTokenize(word, vocab)).toEqual(reference(word, DEFAULT_VOCAB));
        }
    });

    it("reconstructs the word from coverable pieces", () => {
        const vocab = new Set(DEFAULT_VOCAB);
        for (const word of ["playing", "unhappy", "hugging"]) {
            const rebuilt = wordPieceTokenize(word, vocab).map((t) => t.replace(/^##/, "")).join("");
            expect(rebuilt).toBe(word);
        }
    });

    it("emits unknown tokens when the vocabulary lacks a character", () => {
        const vocab = new Set(["a", "b", "[UNK]"]);
        expect(wordPieceTokenize("abz", vocab)).toEqual(["a", "[UNK]", "[UNK]"]);
    });

    it("emits well-formed frames that terminate", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const finalTokens = frames[frames.length - 1]?.meta["tokens"] as string[];
        expect(finalTokens.length).toBeGreaterThan(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(generator.next().done).toBe(true);
        expect(count).toBe(frames.length);
    });
});
