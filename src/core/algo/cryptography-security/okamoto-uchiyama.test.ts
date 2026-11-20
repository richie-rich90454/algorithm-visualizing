/**
 * okamoto-uchiyama.test.ts - Exhaustive small-field roundtrip, homomorphism, randomization, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { decryptValue, encryptValue, findGenerator, modPow } from "./okamoto-uchiyama";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.edges).toEqual([]);
        for (const entity of frame.entities) {
            expect(entity.id).toBeTruthy();
            expect(entity.type).toBe("bar");
            expect(Number.isFinite(entity.value as number)).toBe(true);
        }
    });
}

describe("OkamotoUchiyama", () => {
    const { g, h } = findGenerator();

    it("has a generator whose subgroup condition holds", () => {
        expect(g).toBeGreaterThan(1);
        expect(modPow(g, 100, 101 * 101)).not.toBe(1);
        expect(h).toBe(modPow(g, 101, 101 * 101 * 103));
    });

    it("decrypts every plaintext in the whole small message space", () => {
        for (let m = 0; m < 101; m += 1) {
            for (const r of [1, 5, 37, 96]) {
                const cipher = encryptValue(m, r, g, h);
                expect(decryptValue(cipher, g)).toBe(m);
            }
        }
    });

    it("is additively homomorphic for all pairs of small messages", () => {
        for (const m1 of [0, 1, 7, 42, 100]) {
            for (const m2 of [0, 3, 19, 55]) {
                const c1 = encryptValue(m1, 11, g, h);
                const c2 = encryptValue(m2, 23, g, h);
                const product = (c1 * c2) % (101 * 101 * 103);
                expect(decryptValue(product, g)).toBe((m1 + m2) % 101);
            }
        }
    });

    it("randomizes ciphertexts so the same plaintext encrypts differently", () => {
        const a = encryptValue(42, 3, g, h);
        const b = encryptValue(42, 64, g, h);
        expect(a).not.toBe(b);
        expect(decryptValue(a, g)).toBe(42);
        expect(decryptValue(b, g)).toBe(42);
    });

    it("reports a verified roundtrip and homomorphism in frame metadata", () => {
        const frames = [...mod.run({ plaintext: 42, nonce: 5 })];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["decrypted"]).toBe(42);
        expect(last["homomorphic"]).toBe(true);
        expect(last["ciphertext"]).toBe(encryptValue(42, (5 * 31 + 42 * 17 + 3) % 97 + 1, g, h));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
