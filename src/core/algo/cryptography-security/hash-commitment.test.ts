/**
 * hash-commitment.test.ts - Independent hash reference, exhaustive binding
 * property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { commit, open } from "./hash-commitment";
import type { VisualFrame } from "@/types";

/** Independent FNV-1a written with a plain loop and unsigned shifts. */
function referenceHash(text: string): number {
    let hash = 2166136261;
    for (const character of text) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
        hash >>>= 0;
    }
    return hash >>> 0;
}

function checkFrames(frames: VisualFrame[], preimageLength: number): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("text");
        expect(frame.entities.length).toBe(preimageLength);
        expect(frame.entities.every((entity) => entity.type === "character")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["toyHash"]).toBe(true);
    });
}

describe("Hash Commitment", () => {
    it("matches an independent FNV-1a implementation on the default input", () => {
        const input = mod.defaultInput as { secret: string; nonce: string };
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, `${input.secret}|${input.nonce}`.length);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["commitment"]).toBe(referenceHash(`${input.secret}|${input.nonce}`));
        expect(final?.["opened"]).toBe(true);
    });

    it("is deterministic, binds the secret, and separates nonces in a small domain", () => {
        const seen = new Map<number, string>();
        for (let secret = 0; secret < 40; secret += 1) {
            for (let nonce = 0; nonce < 8; nonce += 1) {
                const commitment = commit(String(secret), String(nonce));
                expect(commitment).toBe(referenceHash(`${secret}|${nonce}`));
                expect(open(commitment, String(secret), String(nonce))).toBe(true);
                expect(open(commitment, String(secret + 1), String(nonce))).toBe(false);
                expect(open(commitment, String(secret), String(nonce + 1))).toBe(false);
                expect(seen.has(commitment)).toBe(false);
                seen.set(commitment, `${secret}|${nonce}`);
            }
        }
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
