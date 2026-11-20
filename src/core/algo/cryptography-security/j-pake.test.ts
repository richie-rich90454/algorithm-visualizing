/**
 * j-pake.test.ts - Schnorr proof checks, brute-force shared-secret agreement,
 * frame shape checks, and termination for the J-PAKE teaching core.
 */

import { describe, expect, it } from "vitest";
import mod, { challenge, jPake, modPow, schnorrProve, schnorrVerify } from "./j-pake";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(40);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(5);
        expect(frame.meta["cols"]).toBe(8);
        expect(frame.meta["agreed"]).toBe(true);
    });
}

describe("J-PAKE algebraic core (toy)", () => {
    it("computes deterministic modular powers and challenges", () => {
        expect(modPow(2, 10, 1009)).toBe(1024 % 1009);
        expect(challenge("x", 5, 7)).toBe(challenge("x", 5, 7));
        expect(challenge("x", 5, 7)).not.toBe(challenge("y", 5, 7));
    });

    it("accepts valid Schnorr proofs and rejects tampered ones", () => {
        for (let secret = 1; secret <= 60; secret += 1) {
            const nonce = 3 + (secret % 17);
            const proof = schnorrProve(secret, "alice-1", nonce);
            expect(schnorrVerify(proof, "alice-1")).toBe(true);
            expect(schnorrVerify(proof, "alice-2")).toBe(false);
            expect(schnorrVerify({ ...proof, response: (proof.response + 1) % 1008 }, "alice-1")).toBe(false);
            expect(schnorrVerify({ ...proof, challenge: (proof.challenge % 1007) + 1 }, "alice-1")).toBe(false);
            expect(schnorrVerify({ ...proof, key: (proof.key % 1008) + 1 }, "alice-1")).toBe(false);
        }
    });

    it("brute-forces shared-secret agreement across many secret pairs", () => {
        for (let trial = 0; trial < 120; trial += 1) {
            const a1 = 1 + (trial % 53);
            const a2 = 3 + (trial % 47);
            const b1 = 5 + (trial % 43);
            const b2 = 7 + (trial % 41);
            const result = jPake(a1, a2, b1, b2, [3, 5, 7, 11]);
            expect(result.proofsValid).toBe(true);
            expect(result.aliceSecret).toBe(result.bobSecret);
            expect(result.aliceSecret).toBeGreaterThan(0);
            expect(result.aliceSecret).toBeLessThan(1009);
            const changed = jPake(a1 + 1, a2, b1, b2, [3, 5, 7, 11]);
            expect(changed.aliceSecret).not.toBe(result.aliceSecret);
        }
    });

    it("emits well-formed frames matching a fresh run", () => {
        const input = mod.defaultInput as { aliceSecrets: number[]; bobSecrets: number[]; nonces: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = jPake(input.aliceSecrets[0]!, input.aliceSecrets[1]!, input.bobSecrets[0]!, input.bobSecrets[1]!, input.nonces);
        expect(frames[frames.length - 1]!.meta["aliceSecret"]).toBe(expected.aliceSecret);
        expect(frames[frames.length - 1]!.meta["bobSecret"]).toBe(expected.bobSecret);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBe(4);
        expect(gen.next().done).toBe(true);
    });
});
