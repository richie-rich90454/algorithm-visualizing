/**
 * lz4-compression.test.ts - Lossless reconstruction from the token stream,
 * match validity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./lz4-compression";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], length: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(length);
        expect(frame.entities.every((entity) => entity.type === "character")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Decode the emitted tokens to check exact reconstruction. */
function decode(tokens: string[]): string {
    let out = "";
    for (const token of tokens) {
        if (token.startsWith("L:")) {
            out += token.slice(2);
        } else if (token.startsWith("M:")) {
            const [offsetText, lengthText] = token.slice(2).split(":");
            const offset = Number(offsetText);
            const length = Number(lengthText);
            expect(offset).toBeGreaterThan(0);
            expect(length).toBeGreaterThanOrEqual(3);
            for (let i = 0; i < length; i += 1) {
                expect(out.length).toBeGreaterThanOrEqual(offset);
                out += out[out.length - offset];
            }
        } else {
            throw new Error(`unexpected token ${token}`);
        }
    }
    return out;
}

describe("LZ4-style compression", () => {
    it("losslessly reconstructs several inputs from the token stream", () => {
        const inputs = [
            "abcabcabcabcabcabc",
            "aaaaaaaaaaaaaaaaaaaa",
            "the quick brown fox jumps over the lazy dog",
            "ab",
            "abcdabcdxyzabcdabcd",
        ];
        for (const text of inputs) {
            const frames = [...mod.run({ text, minMatch: 4 })];
            checkFrames(frames, [...text].length);
            const tokens = frames[frames.length - 1]?.meta["tokens"] as string[];
            expect(decode(tokens)).toBe(text);
            const meta = frames[frames.length - 1]?.meta;
            expect(Number(meta?.["originalSize"])).toBe([...text].length);
            expect(Number(meta?.["literalCount"]) + Number(meta?.["matchCount"])).toBe(tokens.length);
            expect(Number(meta?.["encodedSize"])).toBe(
                tokens.reduce((sum, token) => sum + (token.startsWith("L:") ? 1 : 3), 0),
            );
        }
    });

    it("compresses repetitive input below its original size", () => {
        const frames = [...mod.run({ text: "abcabcabcabcabcabc", minMatch: 4 })];
        checkFrames(frames, 18);
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["matchCount"])).toBeGreaterThan(0);
        expect(Number(meta?.["encodedSize"])).toBeLessThan(Number(meta?.["originalSize"]));
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
