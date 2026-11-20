/**
 * okamoto-identification.test.ts - BigInt reference exponentiation, honest and
 * dishonest transcripts, brute-force uniqueness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { modPow, prove, verifyOkamoto } from "./okamoto-identification";
import type { VisualFrame } from "@/types";

function bigPow(base: number, exponent: number, modulus: number): number {
    let result = 1n;
    let b = BigInt(base) % BigInt(modulus);
    let e = BigInt(exponent);
    const m = BigInt(modulus);
    while (e > 0n) {
        if (e & 1n) result = (result * b) % m;
        b = (b * b) % m;
        e >>= 1n;
    }
    return Number(result);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(7);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(7);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Okamoto Identification Protocol", () => {
    it("matches a BigInt reference for modular exponentiation", () => {
        const p = 1000003;
        for (const base of [2, 5, 17, 0, p - 1]) {
            for (const exponent of [0, 1, 2, 31, 17, 500000, 999999]) {
                expect(modPow(base, exponent, p)).toBe(bigPow(base, exponent, p));
            }
        }
    });

    it("accepts honest transcripts across many secrets, nonces, and challenges", () => {
        const params = [
            { w1: 17, w2: 23, r1: 41, r2: 59 },
            { w1: 3, w2: 9, r1: 7, r2: 11 },
            { w1: 100, w2: 250, r1: 333, r2: 444 },
            { w1: 0, w2: 5, r1: 0, r2: 8 },
        ];
        for (const param of params) {
            for (const challenge of [0, 1, 2, 7, 12345, 999999]) {
                const transcript = prove({ ...param, challenge });
                expect(transcript.accepted).toBe(true);
                const left = (bigPow(2, transcript.s1, transcript.p) * bigPow(5, transcript.s2, transcript.p)) % transcript.p;
                const right = (transcript.t * bigPow(transcript.v, transcript.c, transcript.p)) % transcript.p;
                expect(left).toBe(right);
            }
        }
    });

    it("rejects transcripts with a tampered response", () => {
        const good = prove({ w1: 17, w2: 23, r1: 41, r2: 59, challenge: 99 });
        expect(good.accepted).toBe(true);
        const bad = verifyOkamoto(
            good.p, good.g1, good.g2, good.v, good.t, good.c, good.s1, (good.s2 + 1) % good.order, good.order,
        );
        expect(bad.accepted).toBe(false);
    });

    it("accepts only the correct response pair for a fixed commitment", () => {
        const challenge = 13;
        const good = prove({ w1: 17, w2: 23, r1: 41, r2: 59, challenge });
        let acceptedPairs = 0;
        for (let s1 = (good.s1 + good.order - 2) % good.order; s1 <= good.s1 + 2; s1 += 1) {
            for (let s2 = (good.s2 + good.order - 2) % good.order; s2 <= good.s2 + 2; s2 += 1) {
                const check = verifyOkamoto(good.p, good.g1, good.g2, good.v, good.t, challenge, s1, s2, good.order);
                if (check.accepted) acceptedPairs += 1;
            }
        }
        expect(acceptedPairs).toBe(1);
        expect(good.s1).toBe((41 + challenge * 17) % good.order);
        expect(good.s2).toBe((59 + challenge * 23) % good.order);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
