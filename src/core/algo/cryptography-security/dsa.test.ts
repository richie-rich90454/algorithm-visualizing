/** dsa.test.ts - Signature correctness, tamper rejection, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./dsa";
import type { VisualFrame } from "@/types";

const modPow = (base: number, exp: number, mod: number): number => {
    let result = 1;
    let b = ((base % mod) + mod) % mod;
    let e = exp;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % mod;
        b = (b * b) % mod;
        e = Math.floor(e / 2);
    }
    return result;
};
const modInv = (a: number, m: number): number => {
    let [oldR, r] = [((a % m) + m) % m, m];
    let [oldS, s] = [1, 0];
    while (r !== 0) {
        const q = Math.floor(oldR / r);
        [oldR, r] = [r, oldR - q * r];
        [oldS, s] = [s, oldS - q * s];
    }
    return ((oldS % m) + m) % m;
};
const hashOf = (message: string, q: number): number => [...message].reduce((acc, c) => (acc + c.charCodeAt(0)) % q, 0);
const verify = (p: number, q: number, g: number, y: number, h: number, r: number, s: number): boolean => {
    if (r <= 0 || r >= q || s <= 0 || s >= q) return false;
    const w = modInv(s, q);
    const u1 = (h * w) % q;
    const u2 = (r * w) % q;
    return (modPow(g, u1, p) * modPow(y, u2, p)) % p % q === r;
};

const finalMeta = (frames: VisualFrame[]): VisualFrame["meta"] => (frames[frames.length - 1] as VisualFrame).meta;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("DSA toy signatures", () => {
    it("verifies every honest signature for all secret exponents", () => {
        const messages = ["a", "hello", "message", "verify me", "z".repeat(20)];
        for (let x = 1; x < 11; x += 1) {
            const frames = [...mod.run({ p: 23, q: 11, g: 2, x, messages })];
            checkFrames(frames);
            const meta = finalMeta(frames);
            expect(meta["allValid"]).toBe(true);
            expect(meta["publicKey"]).toBe(modPow(2, x, 23));
            expect((meta["signatures"] as string[]).length).toBe(messages.length);
        }
    });

    it("rejects tampered messages and tampered signatures", () => {
        const p = 23, q = 11, g = 2, x = 7, y = modPow(g, x, p);
        const messages = ["hello", "world"];
        const frames = [...mod.run({ p, q, g, x, messages })];
        const signatures = finalMeta(frames)["signatures"] as string[];
        expect(signatures.length).toBe(messages.length);
        for (const entry of signatures) {
            const [message, h, r, s] = entry.split(":");
            expect(verify(p, q, g, y, Number(h), Number(r), Number(s))).toBe(true);
            expect(verify(p, q, g, y, (Number(h) + 1) % q, Number(r), Number(s))).toBe(false);
            expect(verify(p, q, g, y, Number(h), Number(r), (Number(s) + 1) % q)).toBe(false);
            expect(message).toBeDefined();
        }
    });

    it("rejects a signature produced with the wrong secret", () => {
        const p = 23, q = 11, g = 2, x = 7, y = modPow(g, x, p);
        const h = hashOf("data", q);
        let k = 4;
        const r = modPow(g, k, p) % q;
        const wrongS = (modInv(k, q) * (h + 3 * r)) % q;
        expect(verify(p, q, g, y, h, r, wrongS)).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});
