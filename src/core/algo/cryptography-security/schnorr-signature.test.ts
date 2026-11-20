/**
 * schnorr-signature.test.ts - Independent sign/verify replay, tamper detection,
 * algebraic identity, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./schnorr-signature";
import type { VisualFrame } from "@/types";

const P = 101;
const Q = 100;
const G = 2;

function pow(base: number, exp: number, modulus: number): number {
    let r = 1;
    let b = base % modulus;
    let e = exp;
    while (e > 0) {
        if (e & 1) r = (r * b) % modulus;
        b = (b * b) % modulus;
        e = Math.floor(e / 2);
    }
    return r;
}

function challenge(R: number, y: number, message: string): number {
    let sum = R + y;
    for (let i = 0; i < message.length; i += 1) sum += message.charCodeAt(i);
    return ((sum % Q) + Q) % Q;
}

function sign(secret: number, nonce: number, message: string) {
    const y = pow(G, secret, P);
    const R = pow(G, nonce, P);
    const e = challenge(R, y, message);
    const s = (nonce + e * secret) % Q;
    return { y, R, e, s, lhs: pow(G, s, P), rhs: (R * pow(y, e, P)) % P };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(11);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["p"]).toBe(P);
        expect(frame.meta["q"]).toBe(Q);
        expect(frame.meta["g"]).toBe(G);
    });
}

describe("ToySchnorr", () => {
    it("matches an independent sign/verify replay across inputs", () => {
        const cases = [
            { secret: 23, nonce: 17, message: "hello" },
            { secret: 7, nonce: 44, message: "attack at dawn" },
            { secret: 31, nonce: 9, message: "abc" },
            { secret: 2, nonce: 60, message: "" },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = sign(input.secret, input.nonce, input.message);
            expect(final?.["y"]).toBe(expected.y);
            expect(final?.["R"]).toBe(expected.R);
            expect(final?.["e"]).toBe(expected.e);
            expect(final?.["s"]).toBe(expected.s);
            expect(final?.["lhs"]).toBe(expected.lhs);
            expect(final?.["rhs"]).toBe(expected.rhs);
            expect(final?.["valid"]).toBe(true);
        }
    });

    it("rejects a message that changes the challenge", () => {
        const base = { secret: 23, nonce: 17, message: "hello" };
        const original = sign(base.secret, base.nonce, base.message);
        for (const tampered of ["hello!", "Hello", "goodbye", "hello world"]) {
            if (challenge(original.R, original.y, tampered) === original.e) continue;
            const final = [...mod.run(base)].pop()?.meta;
            const newE = challenge(Number(final?.["R"]), Number(final?.["y"]), tampered);
            const rhs = (Number(final?.["R"]) * pow(Number(final?.["y"]), newE, P)) % P;
            expect(rhs).not.toBe(Number(final?.["lhs"]));
        }
    });

    it("the verification equation is an exact algebraic identity", () => {
        const input = { secret: 23, nonce: 17, message: "algebra" };
        const final = [...mod.run(input)].pop()?.meta;
        const g = Number(final?.["g"] ?? G);
        expect(pow(g, Number(final?.["s"]), P)).toBe(
            (Number(final?.["R"]) * pow(Number(final?.["y"]), Number(final?.["e"]), P)) % P,
        );
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
