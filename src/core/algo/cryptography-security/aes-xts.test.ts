/**
 * aes-xts.test.ts - Toy permutation invertibility, XTS round-trip properties,
 * frame shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { doubleTweak, toyDecrypt, toyEncrypt, xtsDecrypt, xtsEncrypt } from "./aes-xts";
import type { VisualFrame } from "@/types";

const MASK = (1n << 128n) - 1n;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(48);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(16);
        expect(frame.meta["roundTripOk"]).toBe(true);
    });
}

describe("XTS tweakable mode (toy)", () => {
    it("has an invertible toy block permutation", () => {
        for (let key = 0; key < 256; key += 17) {
            for (let i = 0; i < 30; i += 1) {
                const block = (BigInt(i * 7919 + key * 104729) << 64n | BigInt(i + 31)) & MASK;
                expect(toyDecrypt(toyEncrypt(block, key), key)).toBe(block);
                expect(toyEncrypt(block, key)).toBeGreaterThanOrEqual(0n);
                expect(toyEncrypt(block, key)).toBeLessThanOrEqual(MASK);
            }
        }
    });

    it("round-trips plaintexts of every padded length across many keys and tweaks", () => {
        for (let len = 0; len <= 33; len += 1) {
            const plaintext = Array.from({ length: len }, (_, i) => (i * 37 + len * 11) & 0xff);
            for (const [key1, key2, tweak] of [
                [0, 1, 0n],
                [49, 124, 5n],
                [255, 17, 0x1234abcdn],
                [73, 200, MASK],
            ] as const) {
                const cipher = xtsEncrypt(plaintext, key1, key2, tweak);
                expect(cipher.length).toBe(Math.ceil(len / 16) * 16);
                expect(xtsDecrypt(cipher, key1, key2, tweak).slice(0, len)).toEqual(plaintext);
            }
        }
    });

    it("changes the ciphertext when the key or the tweak changes", () => {
        const plaintext = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        const base = xtsEncrypt(plaintext, 49, 124, 5n);
        expect(xtsEncrypt(plaintext, 49, 125, 5n)).not.toEqual(base);
        expect(xtsEncrypt(plaintext, 50, 124, 5n)).not.toEqual(base);
        expect(xtsEncrypt(plaintext, 49, 124, 6n)).not.toEqual(base);
        expect(xtsEncrypt(plaintext, 49, 124, 5n)).toEqual(base);
    });

    it("advances the tweak deterministically without collapsing to zero", () => {
        let t = 0x123456789abcdef0n;
        const seen = new Set<string>();
        for (let i = 0; i < 100; i += 1) {
            expect(t).not.toBe(0n);
            seen.add(t.toString());
            t = doubleTweak(t);
        }
        expect(seen.size).toBe(100);
        expect(doubleTweak(0n)).toBe(0n);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBe(frames.length);
        expect(gen.next().done).toBe(true);
    });
});
