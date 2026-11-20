/**
 * aes-siv.test.ts - Determinism, round-trip, authenticity, frame shape, and
 * termination checks for the SIV teaching core.
 */

import { describe, expect, it } from "vitest";
import mod, { gfDouble, sivDecrypt, sivEncrypt, syntheticIv, toyDecrypt, toyEncrypt, vectorMac } from "./aes-siv";
import type { VisualFrame } from "@/types";

const MASK = (1n << 128n) - 1n;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(3);
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
        expect(frame.meta["authentic"]).toBe(true);
    });
}

describe("SIV deterministic encryption (toy)", () => {
    it("has an invertible toy block cipher", () => {
        for (let key = 0; key < 256; key += 23) {
            for (let i = 0; i < 20; i += 1) {
                const block = (BigInt(i * 31337 + key * 17) << 64n | BigInt(i + 5)) & MASK;
                expect(toyDecrypt(toyEncrypt(block, key), key)).toBe(block);
            }
        }
        expect(gfDouble(0n)).toBe(0n);
    });

    it("is deterministic and round-trips across many inputs", () => {
        for (let len = 0; len <= 34; len += 1) {
            const plaintext = Array.from({ length: len }, (_, i) => (i * 31 + len) & 0xff);
            const ad = [[1, 2, 3], [len & 0xff]];
            for (const key of [0, 61, 255]) {
                const a = sivEncrypt(plaintext, ad, key);
                const b = sivEncrypt(plaintext, ad, key);
                expect(a).toEqual(b);
                const decrypted = sivDecrypt(a.ciphertext, ad, key, a.iv);
                expect(decrypted.authentic).toBe(true);
                expect(decrypted.plaintext).toEqual(plaintext);
                expect(a.ciphertext.length).toBe(len);
            }
        }
    });

    it("binds associated data and rejects tampering or a wrong key", () => {
        const plaintext = [1, 2, 3, 4, 5, 6, 7, 8];
        const ad = [[9, 9], [8, 7]];
        const a = sivEncrypt(plaintext, ad, 42);
        expect(syntheticIv(ad, plaintext, 42)).toBe(a.iv);
        expect(syntheticIv([[9, 9]], plaintext, 42)).not.toBe(a.iv);
        expect(syntheticIv(ad, [...plaintext, 1], 42)).not.toBe(a.iv);
        expect(syntheticIv(ad, plaintext, 43)).not.toBe(a.iv);
        expect(vectorMac([], 42)).toBe(vectorMac([], 42));
        expect(sivDecrypt(a.ciphertext, [[9, 9]], 42, a.iv).authentic).toBe(false);
        expect(sivDecrypt(a.ciphertext, ad, 42, a.iv ^ 1n).authentic).toBe(false);
        const tampered = [...a.ciphertext];
        if (tampered.length > 0) tampered[0] = (tampered[0] ?? 0) ^ 1;
        expect(sivDecrypt(tampered, ad, 42, a.iv).authentic).toBe(false);
        expect(sivDecrypt(sivEncrypt(plaintext, ad, 43).ciphertext, ad, 43, sivEncrypt(plaintext, ad, 43).iv).authentic).toBe(true);
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
