/**
 * dictionary-encoding-rle.test.ts - Independent decode and exactness checks.
 */

import { describe, expect, it } from "vitest";
import mod, { dictionaryRleEncode } from "./dictionary-encoding-rle";
import type { VisualFrame } from "@/types";

/** Independent decoder from the pair stream and dictionary. */
function independentDecode(pairs: Array<[number, number]>, dictionary: string[]): string {
    let out = "";
    for (const [count, rank] of pairs) {
        expect(count).toBeGreaterThan(0);
        expect(rank).toBeGreaterThanOrEqual(0);
        expect(rank).toBeLessThan(dictionary.length);
        out += (dictionary[rank] ?? "").repeat(count);
    }
    return out;
}

function checkFrames(frames: VisualFrame[], symbols: number, pairs: number): void {
    expect(frames.length).toBe(symbols + pairs + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2 * Math.max(1, Math.max(symbols, pairs)));
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(2);
    });
}

describe("Dictionary Encoding with RLE", () => {
    it("round trips every test string through an independent decoder", () => {
        const texts = [
            "AAAABBBCCDDDDEEEE",
            "TOBEORNOTTOBEORTOBEORNOT",
            "hello world",
            "",
            "abababababab",
            "ZZZZZZZZ",
        ];
        for (const text of texts) {
            const result = dictionaryRleEncode(text);
            expect(independentDecode(result.pairs, result.dictionary)).toBe(text);
            expect(result.roundTrip).toBe(text);
            const expanded = result.pairs.reduce((sum, pair) => sum + pair[0], 0);
            expect(expanded).toBe([...text].length);
        }
    });

    it("builds the first-appearance dictionary and maximal runs correctly", () => {
        const result = dictionaryRleEncode("BANANA BANDANA");
        expect(result.dictionary).toEqual(["B", "A", "N", " ", "D"]);
        expect(result.ranks).toEqual([0, 1, 2, 1, 2, 1, 3, 0, 1, 2, 4, 1, 2, 1]);
        const exact = dictionaryRleEncode("AAAABBBCCDDDDEEEE");
        expect(exact.dictionary).toEqual(["A", "B", "C", "D", "E"]);
        expect(exact.pairs).toEqual([
            [4, 0],
            [3, 1],
            [2, 2],
            [4, 3],
            [4, 4],
        ]);
        expect(exact.encodedSymbols).toBe(10);
    });

    it("reports the exact stream in well-formed frames", () => {
        const input = mod.defaultInput as { text: string };
        const frames = [...mod.run(input)];
        const result = dictionaryRleEncode(input.text);
        checkFrames(frames, [...input.text].length, result.pairs.length);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["roundTripOk"]).toBe(true);
        expect(final?.["roundTrip"]).toBe(input.text);
        expect(Number(final?.["dictionarySize"])).toBe(result.dictionary.length);
        expect(Number(final?.["pairCount"])).toBe(result.pairs.length);
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
