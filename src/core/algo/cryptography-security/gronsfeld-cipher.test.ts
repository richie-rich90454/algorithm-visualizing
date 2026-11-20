/** gronsfeld-cipher.test.ts - Reference digit shifts, round-trip, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./gronsfeld-cipher";
import type { VisualFrame } from "@/types";

function digits(key: string): number[] {
    return [...key].map((c) => c.charCodeAt(0) - 48).filter((d) => d >= 0 && d <= 9);
}

function reference(text: string, key: string, decrypt: boolean): string {
    const stream = digits(key);
    const keyStream = stream.length > 0 ? stream : [0];
    let pos = 0;
    return [...text]
        .map((ch) => {
            const code = ch.toUpperCase().charCodeAt(0) - 65;
            if (code < 0 || code > 25) return ch;
            const shift = keyStream[pos % keyStream.length] ?? 0;
            pos += 1;
            const value = decrypt ? (code - shift + 26) % 26 : (code + shift) % 26;
            return String.fromCharCode(65 + value);
        })
        .join("");
}

function outputOf(frames: VisualFrame[]): string {
    return String(frames[frames.length - 1]?.meta["output"] ?? "");
}

function checkFrames(frames: VisualFrame[], length: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(length);
        expect(frame.entities.every((e) => e.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("gronsfeld-cipher", () => {
    it("matches an independent digit-shift cipher", () => {
        const input = mod.defaultInput as { text: string; key: string };
        const frames = [...mod.run(input)];
        checkFrames(frames, [...input.text].length);
        expect(outputOf(frames)).toBe(reference(input.text, input.key, false));
    });

    it("round-trips with punctuation and repeated digits", () => {
        const texts = ["ATTACK AT DAWN!", "ABC", "ZZZZZZ", "123?"];
        for (const text of texts) {
            const cipher = outputOf([...mod.run({ text, key: "9031", mode: "encrypt" })]);
            const plain = outputOf([...mod.run({ text: cipher, key: "9031", mode: "decrypt" })]);
            expect(plain).toBe(text);
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
