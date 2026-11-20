/** book-cipher.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./book-cipher";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.every((entity) => entity.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

const norm = (w: string) => w.toUpperCase().replace(/[^A-Z0-9]/g, "");

function refEncode(text: string, book: string[]): string[] {
    const lookup = new Map<string, [number, number]>();
    book.forEach((line, li) =>
        line.split(/\s+/).forEach((word, wi) => {
            const key = norm(word);
            if (key && !lookup.has(key)) lookup.set(key, [li + 1, wi + 1]);
        }),
    );
    return text
        .split(/\s+/)
        .filter((w) => w.length > 0)
        .map((word) => {
            const coords = lookup.get(norm(word));
            return coords ? `${coords[0]}.${coords[1]}` : `!${word}`;
        });
}

describe("Book Cipher", () => {
    it("round-trips words found in the book and marks unknown words", () => {
        const input = mod.defaultInput as { text: string; book: string[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const tokens = String(frames[frames.length - 1]?.meta["output"]).split(" ");
        expect(tokens).toEqual(refEncode(input.text, input.book));
        const back = [...mod.run({ text: tokens.join(" "), book: input.book, mode: "decode" })];
        expect(back[back.length - 1]?.meta["output"]).toBe(input.text);
    });

    it("round-trips messages mixing known and unknown words", () => {
        const book = ["ALPHA BRAVO CHARLIE DELTA", "ECHO FOXTROT GOLF HOTEL", "INDIA JULIET KILO LIMA"];
        const messages = [
            "ALPHA DELTA",
            "GOLF ALPHA UNKNOWN",
            "MISSING ECHO JULIET",
            "ALPHA ALPHA",
            "LIMA XRAY BRAVO",
        ];
        for (const text of messages) {
            const frames = [...mod.run({ text, book, mode: "encode" })];
            const tokens = String(frames[frames.length - 1]?.meta["output"]).split(" ");
            const back = [...mod.run({ text: tokens.join(" "), book, mode: "decode" })];
            expect(back[back.length - 1]?.meta["output"]).toBe(text);
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
