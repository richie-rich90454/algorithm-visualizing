/** nihilist-cipher.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./nihilist-cipher";
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

const SQUARE = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

function refEncrypt(letters: string[], key: number[]): string[] {
    return letters.map((letter, i) => {
        const normalized = letter === "J" ? "I" : letter;
        const index = SQUARE.indexOf(normalized);
        const value = (Math.floor(index / 5) + 1) * 10 + (index % 5) + 1;
        return String((value + (key[i % key.length] as number) + 100) % 100).padStart(2, "0");
    });
}

function refDecrypt(tokens: string[], key: number[]): string {
    return tokens
        .map((token, i) => {
            const value = (Number.parseInt(token, 10) - (key[i % key.length] as number) + 100) % 100;
            return SQUARE[(Math.floor(value / 10) - 1) * 5 + ((value % 10) - 1)] ?? "?";
        })
        .join("");
}

describe("Nihilist Cipher", () => {
    it("matches a reference and round-trips the default message", () => {
        const input = mod.defaultInput as { text: string; key: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const tokens = String(frames[frames.length - 1]?.meta["output"]).split(" ");
        const letters = [...input.text].filter((ch) => ch >= "A" && ch <= "Z");
        expect(tokens).toEqual(refEncrypt(letters, input.key));
        expect(refDecrypt(tokens, input.key)).toBe(letters.join(""));
        const back = [...mod.run({ text: tokens.join(" "), key: input.key, mode: "decrypt" })];
        expect(back[back.length - 1]?.meta["output"]).toBe(letters.join(""));
    });

    it("round-trips random messages and keys", () => {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let seed = 2718;
        const rand = (n: number) => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % n;
        };
        for (let trial = 0; trial < 100; trial += 1) {
            const letters = Array.from({ length: 1 + rand(25) }, () => alphabet[rand(26)]).join("");
            const key = Array.from({ length: 1 + rand(6) }, () => 10 + rand(90));
            const frames = [...mod.run({ text: letters, key, mode: "encrypt" })];
            const tokens = String(frames[frames.length - 1]?.meta["output"]).split(" ");
            expect(tokens).toEqual(refEncrypt([...letters], key));
            const back = [...mod.run({ text: tokens.join(" "), key, mode: "decrypt" })];
            const expected = letters.replace(/J/g, "I");
            expect(back[back.length - 1]?.meta["output"]).toBe(expected);
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
