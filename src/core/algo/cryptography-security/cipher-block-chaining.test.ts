import { describe, expect, it } from "vitest";
import mod, { cbcDecrypt, cbcEncrypt, toyDecryptByte, toyEncryptByte } from "./cipher-block-chaining";
import type { VisualFrame } from "@/types";

function referenceEncrypt(plain: number[], key: number, iv: number): number[] {
    const enc = (b: number): number => (((b ^ key) * 7 + 13) % 256 + 256) % 256;
    let prev = iv;
    return plain.map((p) => {
        const c = enc(p ^ prev);
        prev = c;
        return c;
    });
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(Number(frame.meta["rows"])).toBe(3);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 8);
        expect(frame.meta).toBeDefined();
    });
}

describe("Cipher Block Chaining (Toy Cipher)", () => {
    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        expect(last?.meta["roundTrip"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });

    it("matches an independent oracle and round-trips random messages", () => {
        let seed = 13579;
        const rand = (limit: number): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed % limit;
        };
        for (let trial = 0; trial < 80; trial += 1) {
            const length = 1 + rand(12);
            const plaintext = Array.from({ length }, () => rand(256));
            const key = rand(256);
            const iv = rand(256);
            const { ciphertext } = cbcEncrypt(plaintext, key, iv);
            expect(ciphertext).toEqual(referenceEncrypt(plaintext, key, iv));
            expect(cbcDecrypt(ciphertext, key, iv)).toEqual(plaintext);
        }
    });

    it("has an invertible toy byte cipher and chains identical blocks", () => {
        for (let key = 0; key < 256; key += 1) {
            for (const value of [0, 1, 42, 128, 255]) {
                expect(toyDecryptByte(toyEncryptByte(value, key), key)).toBe(value);
            }
        }
        const first = cbcEncrypt([9, 9], 91, 17).ciphertext;
        expect(first[0]).not.toBe(first[1]);
    });
});
