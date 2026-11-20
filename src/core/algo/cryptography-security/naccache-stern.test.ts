/**
 * naccache-stern.test.ts - Exhaustive small-field roundtrip, homomorphism, randomization, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { decryptValue, encryptValue, findGenerator, modPow } from "./naccache-stern";
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

describe("NaccacheStern", () => {
    const g = findGenerator();
    const P = 2311;
    const SIGMA = 210;

    it("has a generator of order exactly sigma", () => {
        expect(modPow(g, SIGMA, P)).toBe(1);
        for (const q of [2, 3, 5, 7]) expect(modPow(g, SIGMA / q, P)).not.toBe(1);
        expect(modPow(2, P - 1, P)).toBe(1);
    });

    it("decrypts every message in the full 210-element space", () => {
        for (let m = 0; m < SIGMA; m += 1) {
            expect(decryptValue(encryptValue(m, 3, g), g)).toBe(m);
        }
    });

    it("is additively homomorphic for representative pairs", () => {
        for (const m1 of [0, 1, 17, 83, 209]) {
            for (const m2 of [0, 5, 42, 100]) {
                const c1 = encryptValue(m1, 7, g);
                const c2 = encryptValue(m2, 19, g);
                expect(decryptValue((c1 * c2) % P, g)).toBe((m1 + m2) % SIGMA);
            }
        }
    });

    it("randomizes ciphertexts so equal messages can encrypt differently", () => {
        const ciphertexts = new Set<number>();
        for (let nonce = 0; nonce < 30; nonce += 1) {
            const c = encryptValue(83, nonce, g);
            expect(decryptValue(c, g)).toBe(83);
            ciphertexts.add(c);
        }
        // The toy subgroup has only 11 masks, but several nonces must still differ.
        expect(ciphertexts.size).toBeGreaterThan(1);
    });

    it("reports a verified roundtrip and homomorphism in frame metadata", () => {
        const frames = [...mod.run({ plaintext: 83, nonce: 4 })];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        expect(last["decrypted"]).toBe(83);
        expect(last["homomorphic"]).toBe(true);
        expect(last["ciphertext"]).toBe(encryptValue(83, 4, g));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
