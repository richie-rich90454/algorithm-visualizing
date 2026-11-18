/**
 * rsa-signature-pkcs1-v1-5.test.ts - Signature equation, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./rsa-signature-pkcs1-v1-5";
import type { VisualFrame } from "@/types";

const P = 10007n;
const Q = 10009n;
const N = P * Q;
const PHI = (P - 1n) * (Q - 1n);

function gcd(a: bigint, b: bigint): bigint {
    while (b !== 0n) {
        [a, b] = [b, a % b];
    }
    return a;
}
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let r = 1n;
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    while (e > 0n) {
        if (e % 2n === 1n) r = (r * b) % mod;
        b = (b * b) % mod;
        e /= 2n;
    }
    return r;
}
function digestOf(message: string): number {
    let digest = 0;
    for (let i = 0; i < message.length; i += 1) {
        digest = (digest * 31 + message.charCodeAt(i)) & 0xff;
    }
    return digest;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(15);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(5);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("RsaSignaturePkcs1V15", () => {
    it("satisfies the RSA signature equation for many messages", () => {
        let e = 65537n;
        while (gcd(e, PHI) !== 1n) {
            e -= 2n;
        }
        const messages = ["", "HI", "A", "TEST", "SIGNATURE", "Z".repeat(30)];
        for (const message of messages) {
            const frames = [...mod.run({ message })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            expect(final?.meta["valid"]).toBe(true);
            expect(final?.meta["tamperValid"]).toBe(false);
            expect(Number(frames[2]?.meta["recoveredDigest"])).toBe(digestOf(message));

            const digest = digestOf(message);
            const em = BigInt(`0x0001ff00${digest.toString(16).padStart(2, "0")}`);
            const verifyFrame = frames[2];
            const n = BigInt(String(verifyFrame?.meta["n"]));
            const pub = BigInt(String(verifyFrame?.meta["e"]));
            expect(n).toBe(N);
            expect(pub).toBe(e);
            const sigEntity = verifyFrame?.entities[5];
            expect(sigEntity).toBeDefined();
            const sigBytes = (verifyFrame?.entities ?? []).slice(5, 10).map((c) => Number(c.value));
            let sig = 0n;
            for (const b of sigBytes) sig = (sig << 8n) | BigInt(b);
            expect(modPow(sig, pub, n)).toBe(em);
        }
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
