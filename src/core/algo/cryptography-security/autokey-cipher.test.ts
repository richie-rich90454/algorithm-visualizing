/** autokey-cipher.test.ts - Reference autokey stream, round-trip, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./autokey-cipher";
import type { VisualFrame } from "@/types";

function keyLetters(key: string): number[] {
    return [...key].map((c) => c.toUpperCase().charCodeAt(0) - 65).filter((v) => v >= 0 && v < 26);
}

function reference(text: string, key: string, decrypt: boolean): string {
    const stream = keyLetters(key);
    let pos = 0;
    const out: string[] = [];
    for (const ch of [...text]) {
        const code = ch.toUpperCase().charCodeAt(0) - 65;
        if (code < 0 || code > 25) {
            out.push(ch);
            continue;
        }
        const shift = stream[pos] ?? 0;
        pos += 1;
        const value = decrypt ? (code - shift + 26) % 26 : (code + shift) % 26;
        out.push(String.fromCharCode(65 + value));
        stream.push(decrypt ? value : code);
    }
    return out.join("");
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

describe("autokey-cipher", () => {
    it("matches an independent autokey stream", () => {
        const input = mod.defaultInput as { text: string; key: string };
        const frames = [...mod.run(input)];
        checkFrames(frames, [...input.text].length);
        expect(outputOf(frames)).toBe(reference(input.text, input.key, false));
    });

    it("round-trips letters and preserves non-letters", () => {
        const texts = ["ATTACKATDAWN", "MEET AT DAWN!", "A", "XYZ, 123 ABC"];
        for (const text of texts) {
            const cipher = outputOf([...mod.run({ text, key: "KEY", mode: "encrypt" })]);
            const plain = outputOf([...mod.run({ text: cipher, key: "KEY", mode: "decrypt" })]);
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
