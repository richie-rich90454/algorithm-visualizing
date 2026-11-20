/**
 * frost-signature.test.ts - Independent threshold-signature reference,
 * property checks, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { sign, verify } from "./frost-signature";
import type { VisualFrame } from "@/types";

const P = 23;
const Q = 11;
const G = 2;
const COEFFICIENTS = [6, 2, 2];
const NONCES: Record<number, number> = { 1: 3, 2: 5, 3: 7, 4: 2, 5: 9 };

function power(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let b = base % modulus;
    let e = exponent;
    while (e > 0) {
        if (e % 2 === 1) {
            result = (result * b) % modulus;
        }
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return result;
}

/** Modular inverse via the extended Euclidean algorithm. */
function invert(value: number): number {
    let oldRemainder = ((value % Q) + Q) % Q;
    let remainder = Q;
    let oldCoefficient = 1;
    let coefficient = 0;
    while (remainder !== 0) {
        const quotient = Math.floor(oldRemainder / remainder);
        const nextRemainder = oldRemainder - quotient * remainder;
        const nextCoefficient = oldCoefficient - quotient * coefficient;
        oldRemainder = remainder;
        remainder = nextRemainder;
        oldCoefficient = coefficient;
        coefficient = nextCoefficient;
    }
    return ((oldCoefficient % Q) + Q) % Q;
}

/** Independent signing session built from first principles. */
function reference(signerIds: number[], message: number) {
    const evalAt = (x: number) => COEFFICIENTS.reduce((sum, coefficient, index) => sum + coefficient * power(x, index, Q), 0) % Q;
    const secret = evalAt(0);
    const y = power(G, secret, P);
    const k = signerIds.map((id) => NONCES[id]!);
    const R = k.reduce((product, nonce) => product * power(G, nonce, P) % P, 1);
    const c = (R + message) % Q;
    const partials = signerIds.map((id, position) => {
        let weight = 1;
        for (let j = 0; j < signerIds.length; j += 1) {
            if (j === position) {
                continue;
            }
            weight = weight * ((Q - (signerIds[j]! % Q)) % Q) % Q * invert(signerIds[position]! - signerIds[j]!) % Q;
        }
        return (k[position]! + c * weight * evalAt(id)) % Q;
    });
    const z = partials.reduce((sum, value) => sum + value, 0) % Q;
    return { y, R, c, z, verified: power(G, z, P) === R * power(y, c, P) % P };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["toy"]).toBe(true);
    });
}

describe("FROST Threshold Signature", () => {
    it("matches an independent signing reference on the default input", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference([1, 2, 3], 4);
        expect(final?.["y"]).toBe(expected.y);
        expect(final?.["aggregateR"]).toBe(expected.R);
        expect(final?.["challenge"]).toBe(expected.c);
        expect(final?.["signature"]).toBe(expected.z);
        expect(final?.["verified"]).toBe(expected.verified);
    });

    it("verifies for every three-signer subset and rejects a tampered signature", () => {
        const signers = [1, 2, 3, 4, 5];
        for (let i = 0; i < signers.length; i += 1) {
            for (let j = i + 1; j < signers.length; j += 1) {
                for (let k = j + 1; k < signers.length; k += 1) {
                    const subset = [signers[i]!, signers[j]!, signers[k]!];
                    const result = sign(COEFFICIENTS, subset, subset.map((id) => NONCES[id]!), 4);
                    expect(result.verified).toBe(true);
                    expect(verify(result)).toBe(true);
                    expect(verify({ ...result, signature: (result.signature + 1) % Q })).toBe(false);
                }
            }
        }
    });

    it("fails when fewer than the threshold of shares is used", () => {
        const result = sign(COEFFICIENTS, [1, 2], [NONCES[1]!, NONCES[2]!], 4);
        expect(result.verified).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(4);
        expect(generator.next().done).toBe(true);
    });
});
