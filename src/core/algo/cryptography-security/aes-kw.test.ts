/**
 * aes-kw.test.ts - Toy block invertibility, key-wrap round trips, integrity,
 * frame shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { aesKwUnwrap, aesKwWrap, toBlocks, toyBlock, toyInverse } from "./aes-kw";
import type { VisualFrame } from "@/types";

const MASK128 = (1n << 128n) - 1n;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(24);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(8);
        expect(frame.meta["integrityOk"]).toBe(true);
    });
}

describe("AES Key Wrap (toy)", () => {
    it("has an invertible toy block cipher", () => {
        for (let kek = 0; kek < 256; kek += 19) {
            for (let i = 0; i < 25; i += 1) {
                const block = (BigInt(i * 6571 + kek * 7919) << 64n | BigInt(i + 101)) & MASK128;
                expect(toyInverse(toyBlock(block, kek), kek)).toBe(block);
            }
        }
    });

    it("round-trips keys of many lengths under many key-encryption keys", () => {
        for (let len = 8; len <= 72; len += 8) {
            const keyData = Array.from({ length: len }, (_, i) => (i * 29 + len * 7) & 0xff);
            for (const kek of [0, 42, 127, 255]) {
                const wrapped = aesKwWrap(keyData, kek);
                expect(wrapped.length).toBe(len / 8 + 1);
                const result = aesKwUnwrap(wrapped, kek);
                expect(result.integrity).toBe(true);
                const recovered = result.blocks.flatMap((block) => {
                    const bytes: number[] = [];
                    for (let shift = 56n; shift >= 0n; shift -= 8n) {
                        bytes.push(Number((block >> shift) & 0xffn));
                    }
                    return bytes;
                });
                expect(recovered.slice(0, len)).toEqual(keyData);
            }
        }
    });

    it("pads partial blocks and detects tampering", () => {
        expect(toBlocks([1, 2, 3])).toEqual([0x0102030000000000n]);
        const keyData = [9, 8, 7, 6, 5, 4, 3, 2, 1];
        const wrapped = aesKwWrap(keyData, 42);
        const check = aesKwUnwrap(wrapped, 42);
        expect(check.integrity).toBe(true);
        const tampered = [...wrapped];
        tampered[1] = (tampered[1] ?? 0n) ^ 1n;
        expect(aesKwUnwrap(tampered, 42).integrity).toBe(false);
        const wrongKey = aesKwUnwrap(wrapped, 43);
        expect(wrongKey.integrity).toBe(false);
        expect(aesKwWrap(keyData, 42)).toEqual(wrapped);
        expect(aesKwWrap(keyData, 43)).not.toEqual(wrapped);
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
