/**
 * feige-fiat-shamir.test.ts - Independent protocol reference, honest-prover
 * and cheater properties, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./feige-fiat-shamir";
import type { VisualFrame } from "@/types";

const MODULUS = 253;
const SECRETS = [2, 3, 5, 7, 13];
const NONCES = [4, 6, 8, 9, 12];
const BITS = [1, 0, 1, 1, 0];

/** Independent replay of the five-round protocol. */
function reference(cheater: boolean) {
    const publicKeys = SECRETS.map((secret) => (secret * secret) % MODULUS);
    const verdicts: boolean[] = [];
    const responses: number[] = [];
    for (let i = 0; i < BITS.length; i += 1) {
        const nonce = NONCES[i]!;
        const used = cheater ? SECRETS[i]! + 1 : SECRETS[i]!;
        const response = BITS[i] === 1 ? (nonce * used) % MODULUS : nonce;
        const square = (response * response) % MODULUS;
        const target = BITS[i] === 1 ? ((nonce * nonce) % MODULUS * publicKeys[i]!) % MODULUS : (nonce * nonce) % MODULUS;
        responses.push(response);
        verdicts.push(square === target);
    }
    return { responses, verdicts, ok: verdicts.every(Boolean), publicKeys };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(BITS.length + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(BITS.length);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["modulus"]).toBe(MODULUS);
    });
}

describe("Feige-Fiat-Shamir Identification", () => {
    it("matches an independent honest-prover replay", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const expected = reference(false);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["responses"]).toEqual(expected.responses);
        expect(final?.["verdicts"]).toEqual(expected.verdicts.map((value) => (value ? 1 : 0)));
        expect(final?.["accepted"]).toBe(true);
    });

    it("rejects a cheater who does not know the secrets", () => {
        const frames = [...mod.run({ cheater: true })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["accepted"]).toBe(false);
        expect(final?.["verdicts"]).toEqual(reference(true).verdicts.map((value) => (value ? 1 : 0)));
        expect((final?.["verdicts"] as number[]).some((value) => value === 0)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(BITS.length + 1);
        expect(generator.next().done).toBe(true);
    });
});
