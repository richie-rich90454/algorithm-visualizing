/** fiat-shamir-transform.test.ts - BigInt power reference, proof validity and tamper checks, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { deriveChallenge, powMod, prove, verify } from "./fiat-shamir-transform";
import type { VisualFrame as Frame } from "@/types";

const P = 1000003n;

function bigPow(base: number, exponent: number): number {
    let result = 1n;
    let b = BigInt(base) % P;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) { result = (result * b) % P; }
        b = (b * b) % P;
        e = Math.floor(e / 2);
    }
    return Number(result);
}

function checkFrames(frames: Frame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(5);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Fiat-Shamir transform (toy Schnorr)", () => {
    it("matches an independent BigInt modular exponentiation", () => {
        for (let base = 0; base < 30; base += 1) {
            for (const exponent of [0, 1, 2, 17, 999, 1000002]) {
                expect(powMod(base, exponent, 1000003)).toBe(bigPow(base, exponent));
            }
        }
    });

    it("accepts honest proofs over many secrets and messages", () => {
        for (const secret of [1, 2, 137, 999]) {
            for (const nonce of [1, 5, 911, 5000]) {
                for (const message of ["", "hello", "a different statement"]) {
                    const proof = prove(message, secret, nonce);
                    expect(proof.challenge).toBe(deriveChallenge(proof.commitment, message));
                    expect(verify(message, proof)).toBe(true);
                }
            }
        }
    });

    it("rejects tampered responses, challenges, commitments, and messages", () => {
        const proof = prove("original", 137, 911);
        expect(verify("original", proof)).toBe(true);
        expect(verify("tampered", proof)).toBe(false);
        expect(verify("original", { ...proof, response: proof.response + 1 })).toBe(false);
        expect(verify("original", { ...proof, challenge: proof.challenge + 1 })).toBe(false);
        expect(verify("original", { ...proof, commitment: proof.commitment ^ 1 })).toBe(false);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: Frame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["accepted"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
