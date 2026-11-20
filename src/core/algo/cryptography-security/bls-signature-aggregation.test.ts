/**
 * bls-signature-aggregation.test.ts - Independent pairing replay,
 * bilinearity property, tamper detection, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./bls-signature-aggregation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], signers: number): void {
    expect(frames.length).toBe(signers + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function power(b: number, e: number, m: number): number {
    let r = 1;
    let x = b % m;
    let k = e;
    while (k > 0) {
        if (k & 1) r = (r * x) % m;
        x = (x * x) % m;
        k = Math.floor(k / 2);
    }
    return r;
}

function log(g: number, value: number, p: number): number {
    let cur = 1;
    for (let k = 0; k < p - 1; k += 1) {
        if (cur === value) return k;
        cur = (cur * g) % p;
    }
    return -1;
}

function pair(X: number, Y: number, g: number, p: number): number {
    const lx = log(g, X, p);
    const ly = log(g, Y, p);
    if (lx < 0 || ly < 0) return -1;
    return power(g, (lx * ly) % (p - 1), p);
}

function hField(message: string, index: number, order: number): number {
    let sum = index * 7;
    for (let i = 0; i < message.length; i += 1) sum = (sum + message.charCodeAt(i)) % order;
    return sum % order;
}

/** Reference aggregate and pairing check. */
function verify(
    signers: Array<{ secret: number; message: string }>,
    p: number,
    g: number,
    verifyMessages?: string[],
) {
    const order = p - 1;
    const sigs = signers.map((s, i) => {
        const h = hField(s.message, i, order);
        const H = power(g, h, p);
        const A = power(g, s.secret, p);
        return power(H, s.secret, p);
    });
    const agg = sigs.reduce((product, s) => (product * s) % p, 1);
    const lhs = pair(agg, g, g, p);
    const rhs = signers.reduce((acc, s, i) => {
        const message = verifyMessages ? verifyMessages[i] : s.message;
        const H = power(g, hField(message, i, order), p);
        const A = power(g, s.secret, p);
        return (acc * pair(H, A, g, p)) % p;
    }, 1);
    return { sigs, agg, lhs, rhs, valid: lhs === rhs && lhs >= 0 };
}

describe("BLSSignatureAggregation", () => {
    it("matches an independent aggregate and pairing check", () => {
        const input = mod.defaultInput as {
            p: number;
            g: number;
            signers: Array<{ secret: number; message: string }>;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.signers.length);
        const expected = verify(input.signers, input.p, input.g);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["sigmas"]).toEqual(expected.sigs);
        expect(Number(final?.["aggregate"])).toBe(expected.agg);
        expect(Number(final?.["lhs"])).toBe(expected.lhs);
        expect(Number(final?.["rhs"])).toBe(expected.rhs);
        expect(final?.["valid"]).toBe(true);
    });

    it("the toy pairing is symmetric and multiplicative", () => {
        const p = 11;
        const g = 2;
        const X = power(g, 3, p);
        const Y = power(g, 5, p);
        expect(pair(X, Y, g, p)).toBe(pair(Y, X, g, p));
        expect(pair(X, Y, g, p)).toBe(power(g, 15, p));
        const X2 = power(g, 4, p);
        expect(pair((X * X2) % p, Y, g, p)).toBe((pair(X, Y, g, p) * pair(X2, Y, g, p)) % p);
    });

    it("rejects an aggregate when a verified message is altered", () => {
        const original = [
            { secret: 3, message: "alpha" },
            { secret: 4, message: "beta" },
            { secret: 5, message: "gamma" },
        ];
        const verifyMessages = original.map((s, i) => (i === 1 ? "Z" : s.message));
        expect(verify(original, 11, 2).valid).toBe(true);
        expect(verify(original, 11, 2, verifyMessages).valid).toBe(false);
        const frames = [...mod.run({ p: 11, g: 2, signers: original, verifyMessages })];
        checkFrames(frames, original.length);
        expect(frames[frames.length - 1]?.meta["valid"]).toBe(false);
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
