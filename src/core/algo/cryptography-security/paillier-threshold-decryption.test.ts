/** paillier-threshold-decryption.test.ts - Paillier round trips, homomorphism, and threshold combine. */

import { describe, expect, it } from "vitest";
import mod, {
    combinePartials,
    lFunction,
    paillierDecrypt,
    paillierEncrypt,
    paillierKeygen,
    partialDecrypt,
    powMod,
    splitSecret,
} from "./paillier-threshold-decryption";
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
    });
}

describe("Threshold Paillier decryption toy model", () => {
    it("uses correct modular exponentiation and L function", () => {
        expect(powMod(3n, 17n, 101n)).toBe(referencePow(3n, 17n, 101n));
        expect(lFunction(2401n, 100n)).toBe(24n);
    });

    it("encrypts and decrypts exactly, and is additively homomorphic", () => {
        const key = paillierKeygen();
        for (const message of [0n, 1n, 7n, 1234n, 98765n]) {
            const cipher = paillierEncrypt(message, key);
            expect(paillierDecrypt(cipher, key)).toBe(message);
        }
        const a = paillierEncrypt(17n, key);
        const b = paillierEncrypt(25n, key);
        expect(paillierDecrypt((a * b) % key.n2, key)).toBe(42n);
    });

    it("combines threshold partials but no single share decrypts", () => {
        const key = paillierKeygen();
        const [shareA, shareB] = splitSecret(key);
        expect(shareA + shareB).toBe(key.lambda);
        for (const message of [3n, 88n, 1234n, 43210n]) {
            const cipher = paillierEncrypt(message, key);
            const partialA = partialDecrypt(cipher, shareA, key);
            const partialB = partialDecrypt(cipher, shareB, key);
            expect(combinePartials(partialA, partialB, key)).toBe(message);
            const loneA = (lFunction(partialA, key.n) * key.mu) % key.n;
            expect(loneA).not.toBe(message);
        }
    });

    it("emits well-formed frames and terminates with a correct recovery", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["recovered"]).toBe("1234");
        expect(final?.meta["correct"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
