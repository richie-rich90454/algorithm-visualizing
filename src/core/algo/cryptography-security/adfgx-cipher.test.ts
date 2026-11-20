/**
 * adfgx-cipher.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./adfgx-cipher";
import type { VisualFrame } from "@/types";

interface Input {
    text: string;
    squareKey: string;
    transpositionKey: string;
    mode: string;
}

const COORDS = ["A", "D", "F", "G", "X"];
const BASE = "ABCDEFGHIKLMNOPQRSTUVWXYZ";

/** Independent square builder using a Set-driven filter. */
function refSquare(key: string): string[] {
    const chars = (key + BASE).toUpperCase().replace(/J/g, "I").split("");
    return chars.filter((ch, i) => ch >= "A" && ch <= "Z" && chars.indexOf(ch) === i).slice(0, 25);
}

/** Independent fractionation using array indexing. */
function refFractionate(text: string, square: string[]): string {
    let out = "";
    for (const raw of text.toUpperCase()) {
        const ch = raw === "J" ? "I" : raw;
        const index = square.indexOf(ch);
        out += index < 0 ? raw : COORDS[Math.floor(index / 5)]! + COORDS[index % 5]!;
    }
    return out;
}

/** Independent columnar transposition via sort indexes. */
function refTranspose(text: string, key: string): string {
    const cols = key.length;
    const rows = Math.ceil(text.length / cols);
    const grid: string[][] = [];
    for (let r = 0; r < rows; r += 1) {
        grid.push(Array.from({ length: cols }, (_, c) => text[r * cols + c] ?? "A"));
    }
    const order = key.split("").map((ch, i) => [ch, i] as const).sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] < b[0] ? -1 : 1);
    return order.map(([, c]) => grid.map((row) => row[c]).join("")).join("");
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.every((entity) => entity.type === "character")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("ADFGX Cipher", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent encryptor on the default message", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const square = refSquare(input.squareKey).join("");
        const pairs = refFractionate(input.text, refSquare(input.squareKey));
        const expected = refTranspose(pairs, input.transpositionKey.toUpperCase());
        expect(final?.["square"]).toBe(square);
        expect(final?.["pairs"]).toBe(pairs);
        expect(final?.["ciphertext"]).toBe(expected);
    });

    it("round-trips messages whose length matches the transposition width", () => {
        const cases: Input[] = [
            { text: "ATTACKATDAWN", squareKey: "keyword", transpositionKey: "cats", mode: "encrypt" },
            { text: "MEETMEATNOON", squareKey: "gamma", transpositionKey: "abcd", mode: "encrypt" },
            { text: "RETREATNO", squareKey: "secret", transpositionKey: "key", mode: "encrypt" },
        ];
        for (const encryption of cases) {
            const cipherFrames = [...mod.run(encryption)];
            const cipher = cipherFrames[cipherFrames.length - 1]?.meta["ciphertext"] as string;
            const decryptInput: Input = { ...encryption, text: cipher, mode: "decrypt" };
            const decryptFrames = [...mod.run(decryptInput)];
            checkFrames(decryptFrames);
            const plain = decryptFrames[decryptFrames.length - 1]?.meta["plaintext"] as string;
            expect(plain.replace(/J/g, "I").slice(0, encryption.text.length)).toBe(encryption.text.replace(/J/g, "I"));
        }
    });

    it("is deterministic and preserves the coordinate alphabet", () => {
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        const ciphertext = final?.["ciphertext"] as string;
        expect([...ciphertext].every((ch) => COORDS.includes(ch))).toBe(true);
        const again = [...mod.run(input)];
        expect(again[again.length - 1]?.meta["ciphertext"]).toBe(ciphertext);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
