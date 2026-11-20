/**
 * brotli-compression.test.ts - Independent decode and round-trip checks.
 */

import { describe, expect, it } from "vitest";
import mod, { brotliCompress } from "./brotli-compression";
import type { VisualFrame } from "@/types";

const DICTIONARY = [
    " the ", " and ", " that ", " of ", " to ", " with ",
    "quick", "brown", " fox", " over ", " lazy ", " dog",
    " is ", " for ", "ing", "tion", ".com", "http",
];

const bytesOf = (text: string): number[] =>
    [...text].map((ch) => ch.charCodeAt(0) & 0xff);

/** Independent decoder that replays tokens from scratch. */
function independentDecode(text: string): { out: number[]; bytes: number[] } {
    const result = brotliCompress(text);
    const bytes = bytesOf(text);
    const out: number[] = [];
    for (const token of result.tokens) {
        if (token.kind === "literal") {
            out.push(bytes[token.position] ?? 0);
        } else if (token.kind === "dictionary") {
            const phrase = bytesOf(DICTIONARY[token.dictionaryIndex] ?? "");
            for (let k = 0; k < token.length; k += 1) {
                out.push(phrase[k] ?? 0);
            }
        } else {
            for (let k = 0; k < token.length; k += 1) {
                out.push(out[out.length - token.distance] ?? 0);
            }
        }
    }
    return { out, bytes };
}

function checkFrames(frames: VisualFrame[], byteCount: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(byteCount);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.meta["cols"]).toBe(byteCount);
    });
}

describe("Brotli-Style Compression", () => {
    it("round trips many inputs through an independent decoder", () => {
        const texts = [
            "the quick brown fox jumps over the lazy dog and the quick brown fox runs",
            "aaaaaaaaaaaaaaaaaaaa",
            "hello world",
            "",
            "abababababababababababab",
            "the the the and and and",
        ];
        for (const text of texts) {
            const result = brotliCompress(text);
            const { out, bytes } = independentDecode(text);
            expect(result.roundTrip).toBe(text);
            expect(out).toEqual(bytes);
            expect(result.output).toEqual(out);
            const expectedCost = result.tokens.reduce(
                (sum, t) => sum + (t.kind === "dictionary" ? 2 : t.kind === "copy" ? 3 : 1),
                0,
            );
            expect(result.compressedLength).toBe(expectedCost);
            let covered = 0;
            for (const token of result.tokens) {
                expect(token.position).toBe(covered);
                covered += token.length;
            }
            expect(covered).toBe(bytes.length);
        }
    });

    it("uses only valid dictionary and copy references", () => {
        const text = "the quick brown fox and the quick brown fox over the lazy dog";
        const result = brotliCompress(text);
        const bytes = bytesOf(text);
        const decoded: number[] = [];
        for (const token of result.tokens) {
            if (token.kind === "dictionary") {
                expect(token.length).toBeGreaterThanOrEqual(3);
                const phrase = bytesOf(DICTIONARY[token.dictionaryIndex] ?? "");
                for (let k = 0; k < token.length; k += 1) {
                    expect(phrase[k]).toBe(bytes[token.position + k]);
                    decoded.push(phrase[k] ?? 0);
                }
            } else if (token.kind === "copy") {
                expect(token.distance).toBeGreaterThan(0);
                expect(token.distance).toBeLessThanOrEqual(decoded.length);
                for (let k = 0; k < token.length; k += 1) {
                    const copied = decoded[decoded.length - token.distance] ?? 0;
                    expect(copied).toBe(bytes[token.position + k]);
                    decoded.push(copied);
                }
            } else {
                decoded.push(bytes[token.position] ?? 0);
            }
        }
        expect(decoded).toEqual(bytes);
    });

    it("emits well-formed token frames with a successful final round trip", () => {
        const input = mod.defaultInput as { text: string };
        const frames = [...mod.run(input)];
        const result = brotliCompress(input.text);
        checkFrames(frames, bytesOf(input.text).length);
        expect(frames.length).toBe(result.tokens.length + 2);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["roundTripOk"]).toBe(true);
        expect(final?.["roundTrip"]).toBe(input.text);
        expect(Number(final?.["compressedLength"])).toBe(result.compressedLength);
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
