/**
 * ed25519-signature.test.ts - Independent sign/verify replay, tamper
 * detection, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./ed25519-signature";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(1);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function pow(base: number, exp: number, mod: number): number {
    let r = 1;
    let b = base % mod;
    let e = exp;
    while (e > 0) {
        if (e & 1) r = (r * b) % mod;
        b = (b * b) % mod;
        e = Math.floor(e / 2);
    }
    return r;
}

function hash(R: number, A: number, message: string, order: number): number {
    let sum = R + A;
    for (let i = 0; i < message.length; i += 1) sum += message.charCodeAt(i);
    return ((sum % order) + order) % order;
}

/** Reference signature components derived directly from the equations. */
function sign(p: number, g: number, a: number, r: number, message: string) {
    const order = p - 1;
    const A = pow(g, a, p);
    const R = pow(g, r, p);
    const h = hash(R, A, message, order);
    const s = (r + h * a) % order;
    return { A, R, h, s, lhs: pow(g, s, p), rhs: (R * pow(A, h, p)) % p };
}

describe("Ed25519Signature", () => {
    it("matches an independent sign/verify replay across many inputs", () => {
        const cases = [
            { p: 101, g: 2, secret: 23, nonce: 17, message: "hello" },
            { p: 101, g: 2, secret: 7, nonce: 44, message: "attack at dawn" },
            { p: 103, g: 5, secret: 31, nonce: 9, message: "abc" },
            { p: 107, g: 3, secret: 2, nonce: 60, message: "" },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const expected = sign(input.p, input.g, input.secret, input.nonce, input.message);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["A"])).toBe(expected.A);
            expect(Number(final?.["R"])).toBe(expected.R);
            expect(Number(final?.["h"])).toBe(expected.h);
            expect(Number(final?.["s"])).toBe(expected.s);
            expect(Number(final?.["lhs"])).toBe(expected.lhs);
            expect(Number(final?.["rhs"])).toBe(expected.rhs);
            expect(final?.["valid"]).toBe(true);
        }
    });

    it("rejects a tampered message when the challenge actually changes", () => {
        const base = { p: 101, g: 2, secret: 23, nonce: 17, message: "hello" };
        const original = sign(base.p, base.g, base.secret, base.nonce, base.message);
        for (const tampered of ["hello!", "Hello", "goodbye", "hello world"]) {
            const changedHash = hash(original.R, original.A, tampered, base.p - 1) !== original.h;
            if (!changedHash) continue;
            const frames = [...mod.run(base)];
            const final = frames[frames.length - 1]?.meta;
            // Verification with the original signature but the new challenge.
            const newHash = hash(Number(final?.["R"]), Number(final?.["A"]), tampered, base.p - 1);
            const rhs = (Number(final?.["R"]) * pow(Number(final?.["A"]), newHash, base.p)) % base.p;
            expect(rhs).not.toBe(Number(final?.["lhs"]));
        }
    });

    it("the verification equation is an exact algebraic identity", () => {
        const input = { p: 101, g: 2, secret: 23, nonce: 17, message: "algebra" };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const m = frames[frames.length - 1]?.meta;
        const g = Number(m?.["g"] ?? input.g);
        const s = Number(m?.["s"]);
        const A = Number(m?.["A"]);
        const h = Number(m?.["h"]);
        const R = Number(m?.["R"]);
        expect(pow(g, s, input.p)).toBe((R * pow(A, h, input.p)) % input.p);
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
