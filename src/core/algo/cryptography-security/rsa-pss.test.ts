/** rsa-pss.test.ts - Toy-model PSS encoding, signature round trips, and tamper rejection. */

import { describe, expect, it } from "vitest";
import mod, {
    isPrimeBig,
    mgf1,
    modInverse,
    powMod,
    pssEncode,
    pssVerify,
    rsaPssKeygen,
    rsaPssSign,
    rsaPssVerify,
    toyHash,
} from "./rsa-pss";
import type { VisualFrame } from "@/types";

function referencePow(base: bigint, exp: bigint, m: bigint): bigint {
    let result = 1n;
    for (let i = 0n; i < exp; i += 1n) result = (result * base) % m;
    return result;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("RSA-PSS toy model", () => {
    it("uses correct modular arithmetic and generates primes", () => {
        for (const [base, exp, m] of [[3n, 17n, 101n], [5n, 23n, 97n], [2n, 31n, 1009n]] as const) {
            expect(powMod(base, exp, m)).toBe(referencePow(base, exp, m));
        }
        expect(modInverse(3n, 11n)).toBe(4n);
        for (const n of [101n, 1009n, 104729n]) expect(isPrimeBig(n)).toBe(true);
        for (const n of [100n, 1024n, 104721n]) expect(isPrimeBig(n)).toBe(false);
    });

    it("hashes and masks deterministically without collisions in a small sample", () => {
        const seen = new Set<string>();
        for (let i = 0; i < 120; i += 1) {
            const digest = toyHash([i, i + 1, i + 2, i * 7]);
            expect(digest.length).toBe(8);
            expect(digest).toEqual(toyHash([i, i + 1, i + 2, i * 7]));
            seen.add(digest.join(","));
        }
        expect(seen.size).toBe(120);
        expect(mgf1([1, 2, 3], 25).length).toBe(25);
    });

    it("encodes and verifies EMSA-PSS, rejecting tampering", () => {
        const key = rsaPssKeygen();
        const hash = toyHash([9, 8, 7]);
        const salt = [1, 2, 3, 4, 5, 6, 7, 8];
        const em = pssEncode(hash, key.emBits, salt);
        expect(em[em.length - 1]).toBe(0xbc);
        expect(pssVerify(em, hash, key.emBits, salt.length)).toBe(true);
        const wrong = [...em];
        wrong[wrong.length - 1] = 0x00;
        expect(pssVerify(wrong, hash, key.emBits, salt.length)).toBe(false);
        expect(pssVerify(em, toyHash([9, 8, 6]), key.emBits, salt.length)).toBe(false);
    });

    it("signs and verifies, rejecting changed messages and signatures", () => {
        const key = rsaPssKeygen();
        for (let i = 0; i < 6; i += 1) {
            const message = [i, i + 1, i + 2, i * 3, 42];
            const salt = [i + 1, 2, 3, 4, 5, 6, 7, 8];
            const signature = rsaPssSign(message, key, salt);
            expect(rsaPssVerify(message, signature, key)).toBe(true);
            expect(rsaPssVerify([...message, 99], signature, key)).toBe(false);
            expect(rsaPssVerify(message, signature + 1n, key)).toBe(false);
        }
    });

    it("emits well-formed frames and terminates with acceptance", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["verified"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
