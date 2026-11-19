/** blind-signature.test.ts - BigInt RSA reference, exhaustive blinding/unblinding, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { blind, modInverse, powMod, signBlind, unblind, verifySignature } from "./blind-signature";
import type { VisualFrame } from "@/types";

const N = 3233n;
function bigPow(base: number, exponent: number): number {
    let result = 1n;
    let b = BigInt(base) % N;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) { result = (result * b) % N; }
        b = (b * b) % N;
        e = Math.floor(e / 2);
    }
    return Number(result);
}
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Blind signature (toy RSA)", () => {
    it("matches an independent BigInt modular exponentiation", () => {
        for (let base = 0; base < 40; base += 1) {
            for (const exponent of [0, 1, 17, 2753]) {
                expect(powMod(base, exponent, 3233)).toBe(bigPow(base, exponent));
            }
        }
    });

    it("computes inverses that undo multiplication modulo n", () => {
        for (let value = 1; value < 3233; value += 1) {
            const inverse = modInverse(value, 3233);
            if (gcd(value, 3233) === 1) {
                expect((value * inverse) % 3233).toBe(1);
            } else {
                expect(inverse).toBe(0);
            }
        }
    });

    it("unblinds to the direct signature over many messages and factors", () => {
        let hidings = 0;
        let total = 0;
        for (let message = 0; message < 3233; message += 53) {
            for (let factor = 2; factor < 80; factor += 1) {
                if (gcd(factor, 3233) !== 1) { continue; }
                const blinded = blind(message, factor);
                const signed = signBlind(blinded);
                const signature = unblind(signed, factor);
                const direct = bigPow(message, 2753);
                expect(signature).toBe(direct);
                expect(verifySignature(signature, message)).toBe(true);
                total += 1;
                if (blinded !== message) { hidings += 1; }
            }
        }
        expect(total).toBeGreaterThan(100);
        expect(hidings).toBeGreaterThan(total * 0.9);
    });

    it("rejects unblinding with the wrong factor", () => {
        const message = 42;
        const signed = signBlind(blind(message, 7));
        expect(unblind(signed, 7)).toBe(bigPow(message, 2753));
        const wrong = unblind(signed, 11);
        expect(verifySignature(wrong, message)).toBe(false);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["accepted"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
