import { describe, expect, it } from "vitest";
import mod, { egHash, egInverse, egPow, elgamalSign, elgamalVerify } from "./elgamal-signature";
import type { VisualFrame } from "@/types";

function referencePow(base: number, exp: number, mod: number): number {
    let result = 1n;
    let b = BigInt(((base % mod) + mod) % mod);
    let e = BigInt(exp);
    const m = BigInt(mod);
    while (e > 0n) {
        if (e & 1n) result = (result * b) % m;
        b = (b * b) % m;
        e >>= 1n;
    }
    return Number(result);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 8);
        expect(frame.meta).toBeDefined();
    });
}

describe("ElGamal Signature (Toy Prime Field)", () => {
    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        const last = frames[frames.length - 1];
        expect(last?.meta["valid"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });

    it("matches an independent pow and inverse oracle", () => {
        for (const [base, exp, modulus] of [
            [2, 13, 1000003],
            [7, 0, 101],
            [5, 29, 1009],
        ]) {
            expect(egPow(base as number, exp as number, modulus as number)).toBe(
                referencePow(base as number, exp as number, modulus as number),
            );
        }
        for (const value of [5, 7, 11, 13]) {
            const inverse = egInverse(value, 1000002);
            expect(inverse).not.toBeNull();
            expect(Number((BigInt(value) * BigInt(inverse as number)) % 1000002n)).toBe(1);
        }
        expect(egInverse(2, 1000002)).toBeNull();
        expect(egHash("hi", 1000002)).toBe(209);
    });

    it("verifies genuine signatures and rejects tampering", () => {
        let seed = 828282;
        const rand = (limit: number): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed % limit;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const secret = 2 + rand(500);
            const nonce = 5 + rand(50);
            if (egInverse(nonce, 1000002) === null) {
                continue;
            }
            const message = `m${trial}`;
            const signed = elgamalSign(1000003, 2, secret, nonce, message);
            expect(signed.valid).toBe(true);
            expect(signed.lhs).toBe(referencePow(2, signed.hash, 1000003));
            expect(signed.rhs).toBe((referencePow(signed.y, signed.r, 1000003) * referencePow(signed.r, signed.s, 1000003)) % 1000003);
            expect(elgamalVerify(1000003, 2, signed.y, egHash(`${message}x`, 1000002), signed.r, signed.s)).toBe(false);
            expect(elgamalVerify(1000003, 2, signed.y, signed.hash, (signed.r + 1) % 1000003, signed.s)).toBe(false);
            expect(elgamalVerify(1000003, 2, signed.y + 1, signed.hash, signed.r, signed.s)).toBe(false);
            expect(elgamalVerify(1000003, 2, signed.y, signed.hash, signed.r, signed.s)).toBe(true);
        }
    });
});
