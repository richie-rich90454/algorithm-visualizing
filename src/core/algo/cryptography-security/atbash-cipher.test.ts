/** atbash-cipher.test.ts - Involution property, brute-force reference, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./atbash-cipher";
import type { VisualFrame } from "@/types";

function reference(text: string): string {
    return [...text]
        .map((ch) => {
            const upper = ch.toUpperCase();
            const code = upper.charCodeAt(0) - 65;
            if (code < 0 || code > 25) return ch;
            const mapped = String.fromCharCode(65 + (25 - code));
            return ch === upper ? mapped : mapped.toLowerCase();
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

describe("atbash-cipher", () => {
    it("matches a brute-force letter mirror", () => {
        const input = mod.defaultInput as { text: string };
        const frames = [...mod.run(input)];
        checkFrames(frames, [...input.text].length);
        expect(outputOf(frames)).toBe(reference(input.text));
    });

    it("is an involution on many random messages", () => {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ,.";
        let seed = 12345;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        for (let t = 0; t < 30; t += 1) {
            let text = "";
            const len = 1 + Math.floor(rand() * 20);
            for (let i = 0; i < len; i += 1) text += alphabet[Math.floor(rand() * alphabet.length)];
            const once = outputOf([...mod.run({ text })]);
            const twice = outputOf([...mod.run({ text: once })]);
            expect(once).toBe(reference(text));
            expect(twice).toBe(text);
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
