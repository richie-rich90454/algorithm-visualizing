/**
 * rsa-encryption-decryption.test.ts - Exhaustive round-trip over every
 * residue, independent slow exponentiation, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./rsa-encryption-decryption";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Deliberately slow repeated-multiplication exponentiation. */
function slowPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    for (let i = 0; i < exponent; i += 1) {
        result = (result * base) % modulus;
    }
    return result;
}

function gcd(a: number, b: number): number {
    while (b !== 0) {
        [a, b] = [b, a % b];
    }
    return a;
}

describe("RSAEncryptionDecryption", () => {
    it("round-trips every residue for the default keypair", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const n = Number(final?.["n"]);
        const e = Number(final?.["e"]);
        const d = Number(final?.["d"]);
        const phi = Number(final?.["phi"]);
        expect(n).toBe(143);
        expect(phi).toBe(120);
        expect(gcd(e, phi)).toBe(1);
        expect((e * d) % phi).toBe(1);
        for (let m = 0; m < n; m += 1) {
            const c = slowPow(m, e, n);
            expect(slowPow(c, d, n)).toBe(m);
        }
    });

    it("round-trips every residue for several small keypairs", () => {
        const keypairs = [
            { p: 5, q: 11, e: 3 },
            { p: 7, q: 13, e: 5 },
            { p: 17, q: 19, e: 7 },
        ];
        for (const { p, q, e } of keypairs) {
            for (let m = 0; m < p * q; m += 1) {
                const frames = [...mod.run({ p, q, e, m })];
                checkFrames(frames);
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["original"]).toBe(m);
                expect(Number(final?.["m"])).toBe(m);
            }
        }
    });

    it("matches the square-and-multiply ciphertext against slow exponentiation", () => {
        const input = { p: 11, q: 13, e: 7, m: 64 };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const encryptFrame = frames[2]?.meta;
        expect(Number(encryptFrame?.["c"])).toBe(slowPow(64, 7, 143));
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
