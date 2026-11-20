/**
 * lzss-compression.test.ts - Round-trip and token-validity properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lzss-compression";
import type { VisualFrame } from "@/types";

type Token = { literal: string } | { offset: number; length: number };

/** Independent reference encoder written with explicit match scanning. */
function referenceEncode(text: string, window: number, minMatch: number): Token[] {
    const out: Token[] = [];
    let at = 0;
    while (at < text.length) {
        let bestLen = 0;
        let bestOffset = 0;
        // Scan offsets from largest to smallest; keep the first on ties, matching
        // the module's left-to-right scan of window positions.
        for (let offset = Math.min(window, at); offset >= 1; offset -= 1) {
            let length = 0;
            while (at + length < text.length && text[at - offset + length] === text[at + length]) {
                length += 1;
            }
            if (length > bestLen) {
                bestLen = length;
                bestOffset = offset;
            }
        }
        if (bestLen >= minMatch) {
            out.push({ offset: bestOffset, length: bestLen });
            at += bestLen;
        } else {
            out.push({ literal: text[at] ?? "" });
            at += 1;
        }
    }
    return out;
}

function decode(tokens: Token[]): string {
    let out = "";
    for (const token of tokens) {
        if ("literal" in token) {
            out += token.literal;
        } else {
            for (let k = 0; k < token.length; k += 1) out += out[out.length - token.offset] ?? "";
        }
    }
    return out;
}

function describeToken(token: Token): string {
    return "literal" in token ? `L'${token.literal}'` : `M(${token.offset},${token.length})`;
}

function checkFrames(frames: VisualFrame[], textLength: number): void {
    expect(frames.length).toBeGreaterThan(0);
    const lines = mod.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(textLength);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber!).toBeLessThan(lines);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["roundTrip"]).toBe(true);
    });
}

function runCase(text: string, window: number, minMatch: number) {
    const frames = [...mod.run({ text, window, minMatch })];
    checkFrames(frames, text.length);
    const final = frames[frames.length - 1];
    const tokens = final?.meta["tokens"] as string[];
    return { frames, final, tokens };
}

describe("LZSS Compression", () => {
    it("round-trips the default input and matches the reference tokens", () => {
        const input = mod.defaultInput as { text: string; window: number; minMatch: number };
        const { tokens, final } = runCase(input.text, input.window, input.minMatch);
        const expectedTokens = referenceEncode(input.text, input.window, input.minMatch);
        expect(tokens).toEqual(expectedTokens.map(describeToken));
        expect(decode(expectedTokens)).toBe(input.text);
        expect(final?.meta["roundTrip"]).toBe(true);
    });

    it("round-trips many texts with valid matches", () => {
        const texts = ["aaaaab", "ababababab", "abcabcabcabc", "the rain in spain", "xyzxyzxyzxyzxyz"];
        for (const text of texts) {
            const { final } = runCase(text, 8, 2);
            const tokens = final?.meta["tokens"] as string[];
            let produced = 0;
            for (const token of tokens) {
                if (token.startsWith("L")) {
                    produced += 1;
                } else {
                    const parts = token.match(/M\((\d+),(\d+)\)/);
                    expect(parts).not.toBeNull();
                    const offset = Number(parts?.[1]);
                    const length = Number(parts?.[2]);
                    expect(offset).toBeGreaterThanOrEqual(1);
                    expect(offset).toBeLessThanOrEqual(8);
                    expect(offset).toBeLessThanOrEqual(produced);
                    expect(length).toBeGreaterThanOrEqual(2);
                    produced += length;
                }
            }
            expect(produced).toBe(text.length);
        }
    });

    it("actually compresses a repetitive string", () => {
        const text = "abcabcabcabcabcabcabcabc";
        const { final } = runCase(text, 8, 2);
        expect(Number(final?.meta["tokenCount"])).toBeLessThan(text.length);
    });

    it("handles empty and short text without matches", () => {
        for (const text of ["a", "abcd"]) {
            const { final } = runCase(text, 8, 2);
            expect(Number(final?.meta["tokenCount"])).toBe(text.length);
            expect(final?.meta["roundTrip"]).toBe(true);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
