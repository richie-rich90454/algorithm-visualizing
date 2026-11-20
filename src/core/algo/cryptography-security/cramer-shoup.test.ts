/**
 * cramer-shoup.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./cramer-shoup";
import type { VisualFrame } from "@/types";

interface Secret {
    x1: number;
    x2: number;
    y1: number;
    y2: number;
    z: number;
}
interface Input {
    p: number;
    q: number;
    g1: number;
    g2: number;
    h: number;
    k: number;
    r: number;
    secret: Secret;
    tamper: boolean;
}

/** Independent modular power by a plain loop. */
function pw(base: number, exp: number, mod: number): number {
    let result = 1;
    for (let i = 0; i < exp; i += 1) result = (result * base) % mod;
    return result;
}

/** Independent reference encryption and decryption of a group element. */
function reference(input: Input) {
    const { p, q, g1, g2, h, k, r, secret } = input;
    const c = (pw(g1, secret.x1, p) * pw(g2, secret.x2, p)) % p;
    const d = (pw(g1, secret.y1, p) * pw(g2, secret.y2, p)) % p;
    const message = pw(g1, k, p);
    const u1 = pw(g1, r, p);
    const u2 = pw(g2, r, p);
    const u3 = (pw(h, r, p) * message) % p;
    const alpha = (u1 + u2 + u3) % q;
    const u4 = pw((c * pw(d, alpha, p)) % p, r, p);
    const check = (pw(u1, secret.x1 + secret.y1 * alpha, p) * pw(u2, secret.x2 + secret.y2 * alpha, p)) % p;
    let inverse = 1;
    for (let i = 1; i < p; i += 1) if ((pw(u1, secret.z, p) * i) % p === 1) inverse = i;
    const clear = (u3 * inverse) % p;
    return { c, d, message, u1, u2, u3, u4, alpha, check, clear };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Cramer-Shoup Encryption", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent reference and decrypts the message element", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input);
        expect(final?.["publicC"]).toBe(expected.c);
        expect(final?.["publicD"]).toBe(expected.d);
        expect(final?.["ciphertext"]).toEqual([expected.u1, expected.u2, expected.u3, expected.u4]);
        expect(final?.["alpha"]).toBe(expected.alpha);
        expect(final?.["check"]).toBe(expected.check);
        expect(final?.["valid"]).toBe(1);
        expect(final?.["clear"]).toBe(expected.message);
    });

    it("round-trips for every message and exponent in the toy group", () => {
        for (let k = 0; k < 11; k += 1) {
            for (let r = 1; r < 11; r += 1) {
                const testInput: Input = { ...input, k, r };
                const frames = [...mod.run(testInput)];
                checkFrames(frames);
                const final = frames[frames.length - 1]?.meta;
                const expected = reference(testInput);
                expect(final?.["valid"]).toBe(1);
                expect(final?.["clear"]).toBe(expected.message);
            }
        }
    });

    it("rejects a tampered ciphertext tuple", () => {
        const frames = [...mod.run({ ...input, tamper: true })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["valid"]).toBe(0);
        expect(final?.["clear"]).toBe(-1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
