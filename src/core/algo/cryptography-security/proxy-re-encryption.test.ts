/**
 * proxy-re-encryption.test.ts - Independent algebraic reference, re-encryption
 * correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./proxy-re-encryption";
import type { VisualFrame } from "@/types";

function modpow(base: bigint, exp: bigint, m: bigint): bigint {
    let out = 1n;
    let b = ((base % m) + m) % m;
    let e = exp;
    while (e > 0n) {
        if (e & 1n) out = (out * b) % m;
        b = (b * b) % m;
        e >>= 1n;
    }
    return out;
}

function decrypt(c1: bigint, c2: bigint, secret: bigint, p: bigint): bigint {
    return (c2 * modpow(modpow(c1, secret, p), p - 2n, p)) % p;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(6);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("toy proxy re-encryption", () => {
    const cases = [
        { p: 1000003, g: 2, a: 137, b: 911, k: 251, m: 42 },
        { p: 101, g: 3, a: 7, b: 19, k: 11, m: 55 },
        { p: 1009, g: 11, a: 44, b: 300, k: 77, m: 500 },
    ];

    it("matches an independent algebraic reference", () => {
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames);
            const last = frames[frames.length - 1]?.meta;
            const p = BigInt(c.p);
            const g = BigInt(c.g);
            const a = BigInt(c.a);
            const b = BigInt(c.b);
            const k = BigInt(c.k);
            const m = BigInt(c.m);
            const order = p - 1n;
            const A = modpow(g, a, p);
            const B = modpow(g, b, p);
            const rk = (((b - a) % order) + order) % order;
            const c1 = modpow(g, k, p);
            const c2 = (m * modpow(A, k, p)) % p;
            const c2Prime = (c2 * modpow(c1, rk, p)) % p;
            expect(last?.["A"]).toBe(Number(A));
            expect(last?.["B"]).toBe(Number(B));
            expect(last?.["rk"]).toBe(Number(rk));
            expect(last?.["c1"]).toBe(Number(c1));
            expect(last?.["c2"]).toBe(Number(c2));
            expect(last?.["c2Prime"]).toBe(Number(c2Prime));
            expect(last?.["alicePlain"]).toBe(Number(m));
            expect(last?.["bobPlain"]).toBe(Number(m));
            expect(last?.["works"]).toBe(true);
            expect(decrypt(c1, c2, a, p)).toBe(m);
            expect(decrypt(c1, c2Prime, b, p)).toBe(m);
        }
    });

    it("actually redirects the ciphertext to Bob", () => {
        const c = cases[0];
        const frames = [...mod.run(c)];
        const last = frames[frames.length - 1]?.meta;
        const p = BigInt(c.p);
        const c1 = BigInt(Number(last?.["c1"]));
        const c2Prime = BigInt(Number(last?.["c2Prime"]));
        // Bob recovers the message; Alice's secret no longer does.
        expect(decrypt(c1, c2Prime, BigInt(c.b), p)).toBe(BigInt(c.m));
        expect(decrypt(c1, c2Prime, BigInt(c.a), p)).not.toBe(BigInt(c.m));
    });

    it("reports success on the default run", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames[frames.length - 1]?.meta["works"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
