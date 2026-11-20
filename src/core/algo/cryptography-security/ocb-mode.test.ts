/**
 * ocb-mode.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./ocb-mode";
import type { VisualFrame } from "@/types";

const sbox = (v: number): number => (v * 13 + 7) & 0xff;
const enc = (b: number, k: number): number => sbox((b ^ k) & 0xff);
function offsets(nonce: number, key: number, count: number): number[] {
    const l = enc(0, key);
    const base = enc(nonce ^ l, key);
    return Array.from({ length: count + 1 }, (_, i) => (base + i * l) & 0xff);
}
function reference(plaintext: number[], key: number, nonce: number) {
    const off = offsets(nonce, key, plaintext.length);
    const ciphertext = plaintext.map((p, i) => p ^ enc(off[i] ?? 0, key));
    let checksum = 0;
    for (const p of plaintext) { checksum ^= p; }
    const tag = enc(checksum ^ (off[plaintext.length] ?? 0), key);
    return { ciphertext, tag };
}

function framesFor(input: unknown): VisualFrame[] {
    const frames = [...mod.run(input)];
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    return frames;
}
function finalMeta(input: unknown): Record<string, unknown> {
    const frames = framesFor(input);
    return frames[frames.length - 1]?.meta as unknown as Record<string, unknown>;
}

describe("OCB toy authenticated encryption", () => {
    it("matches an independent reference and round-trips", () => {
        for (let key = 0; key < 256; key += 31) {
            for (const nonce of [0, 7, 200]) {
                const plaintext = [72, 105, 33, 42, 68, 69, 83];
                const meta = finalMeta({ plaintext, key, nonce });
                const expected = reference(plaintext, key, nonce);
                expect(meta["ciphertext"]).toEqual(expected.ciphertext);
                expect(meta["tag"]).toBe(expected.tag);
                expect(meta["decrypted"]).toEqual(plaintext);
                expect(meta["tagValid"]).toBe(true);
            }
        }
    });

    it("detects tampered ciphertext", () => {
        const plaintext = [10, 20, 30, 40];
        const good = finalMeta({ plaintext, key: 5, nonce: 9 });
        const cipher = [...(good["ciphertext"] as number[])];
        cipher[1] = (cipher[1] ?? 0) ^ 0xff;
        const off = offsets(9, 5, plaintext.length);
        const decrypted = cipher.map((c, i) => c ^ enc(off[i] ?? 0, 5));
        const checksum = decrypted.reduce((a, b) => a ^ b, 0);
        const recomputedTag = enc(checksum ^ (off[plaintext.length] ?? 0), 5);
        expect(recomputedTag).not.toBe(good["tag"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
