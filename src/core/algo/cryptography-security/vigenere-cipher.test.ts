/**
 * vigenere-cipher.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./vigenere-cipher";
import type { VisualFrame } from "@/types";

function encrypt(plain: string, key: string): string {
    return plain
        .split("")
        .map((char, i) =>
            String.fromCharCode(65 + (((char.charCodeAt(0) - 65 + (key.charCodeAt(i % key.length) - 65)) % 26) + 26) % 26),
        )
        .join("");
}

function decrypt(cipher: string, key: string): string {
    return cipher
        .split("")
        .map((char, i) =>
            String.fromCharCode(65 + ((((char.charCodeAt(0) - 65 - (key.charCodeAt(i % key.length) - 65)) % 26) + 26) % 26)),
        )
        .join("");
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Vigenere Cipher", () => {
    it("matches an independent reference and round-trips", () => {
        const input = mod.defaultInput as { plaintext: string; keyword: string };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta ?? {};
        expect(final["ciphertext"]).toBe(encrypt(input.plaintext, input.keyword));
        expect(final["plaintext"]).toBe(decrypt(final["ciphertext"] as string, input.keyword));
        expect(final["plaintext"]).toBe(input.plaintext);
    });

    it("round-trips many messages and keywords", () => {
        const inputs = [
            { plaintext: "ATTACKATDAWN", keyword: "LEMON" },
            { plaintext: "MEETMEATMIDNIGHT", keyword: "KEY" },
            { plaintext: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", keyword: "ABC" },
            { plaintext: "TEST", keyword: "Z" },
        ];
        for (const input of inputs) {
            const frames = [...mod.run(input)];
            const final = frames[frames.length - 1]?.meta ?? {};
            expect(final["plaintext"]).toBe(input.plaintext);
            expect(final["ciphertext"]).toBe(encrypt(input.plaintext, input.keyword));
        }
    });

    it("handles non-letter characters and an empty key", () => {
        const frames = [...mod.run({ plaintext: "At-tack at dawn!", keyword: "lemon" })];
        const final = frames[frames.length - 1]?.meta ?? {};
        expect(final["plaintext"]).toBe("ATTACKATDAWN");
        const empty = [...mod.run({ plaintext: "ABC", keyword: "" })];
        expect(empty.length).toBeGreaterThan(0);
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
