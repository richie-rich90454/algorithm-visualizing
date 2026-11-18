/**
 * paillier-additive-homomorphism.test.ts - Property-based homomorphism check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./paillier-additive-homomorphism";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function finalMeta(a: number, b: number, p = 7, q = 11, r = 2) {
    const frames = [...mod.run({ a, b, p, q, r })];
    checkFrames(frames);
    return frames[frames.length - 1]?.meta ?? {};
}

describe("Paillier additive homomorphism (toy)", () => {
    it("satisfies the homomorphism on a grid of small messages", () => {
        const rs = [2, 3, 4, 5, 6, 8, 9, 10];
        for (const a of [0, 1, 5, 11, 30, 50]) {
            for (const b of [0, 2, 7, 13, 25, 49]) {
                for (const r of rs) {
                    const meta = finalMeta(a, b, 7, 11, r);
                    expect(Number(meta["decryptedSum"])).toBe((a + b) % 77);
                    expect(Number(meta["expected"])).toBe((a + b) % 77);
                }
            }
        }
    });

    it("decrypting a single ciphertext returns the plaintext (homomorphism with zero)", () => {
        for (const a of [0, 3, 17, 42, 76]) {
            const meta = finalMeta(a, 0);
            expect(Number(meta["decryptedSum"])).toBe(a);
        }
    });

    it("wraps modulo n when the sum reaches the modulus", () => {
        const meta = finalMeta(40, 50);
        expect(Number(meta["decryptedSum"])).toBe((40 + 50) % 77);
    });

    it("publishes the algebraic parameters", () => {
        const meta = finalMeta(5, 7);
        expect(meta["n"]).toBe(77);
        expect(meta["n2"]).toBe(5929);
        expect(meta["lambda"]).toBe(30);
        expect(meta["mu"]).toBe(18);
        expect(BigInt(String(meta["cipherProduct"])) < BigInt(5929)).toBe(true);
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
