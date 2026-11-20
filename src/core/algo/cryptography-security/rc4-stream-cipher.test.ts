/**
 * rc4-stream-cipher.test.ts - Published RC4 test vectors, permutation and XOR
 * properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { ksa, prga } from "./rc4-stream-cipher";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBe(count + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("RC4 Stream Cipher", () => {
    it("matches the published key/plaintext/ciphertext vectors", () => {
        const vectors: Array<{ key: string; plaintext: string; cipher: string; keystream: string }> = [
            { key: "Key", plaintext: "Plaintext", cipher: "bbf316e8d940af0ad3", keystream: "eb9f7781b734ca72a7" },
            { key: "Wiki", plaintext: "pedia", cipher: "1021bf0420", keystream: "6044db6d41" },
            { key: "Secret", plaintext: "Attack at dawn", cipher: "45a01f645fc35b383552544b9bf5", keystream: "04d46b053ca87b594172302aec9b" },
        ];
        for (const vector of vectors) {
            const frames = [...mod.run({ key: vector.key, plaintext: vector.plaintext })];
            checkFrames(frames, vector.plaintext.length);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["keystreamHex"]).toBe(vector.keystream);
            expect(final?.["ciphertextHex"]).toBe(vector.cipher);
            expect(final?.["decrypted"]).toBe(vector.plaintext);
            expect(final?.["roundTrip"]).toBe(true);
            expect(final?.["plaintextHex"]).toBe(
                vector.plaintext.split("").map((ch) => ch.charCodeAt(0).toString(16).padStart(2, "0")).join(""),
            );
        }
    });

    it("keeps the state box a permutation and consumes one byte per position", () => {
        for (const key of ["", "a", "abc", "a longer key"]) {
            const box = ksa(key || "Key");
            const sorted = [...box].sort((a, b) => a - b);
            expect(sorted).toEqual(Array.from({ length: 256 }, (_v, i) => i));
            const stream = prga([...box], 64);
            expect(stream.length).toBe(64);
            expect(stream.every((byte) => byte >= 0 && byte <= 255)).toBe(true);
        }
    });

    it("round-trips arbitrary short ASCII messages", () => {
        const messages = ["", "A", "hello world", "ABC123xyz", "attack at dawn!!"];
        for (const plaintext of messages) {
            const frames = [...mod.run({ key: "secret", plaintext })];
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["decrypted"]).toBe(plaintext);
            expect(final?.["roundTrip"]).toBe(true);
        }
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
