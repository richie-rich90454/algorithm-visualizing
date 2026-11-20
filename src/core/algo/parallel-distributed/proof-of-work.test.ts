/**
 * proof-of-work.test.ts - Brute-force nonce search comparison, one-step
 * verification, difficulty properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { leadingZeros, powHash } from "./proof-of-work";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(16);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Proof of Work", () => {
    it("finds the same smallest nonce as an independent brute-force search", () => {
        const input = mod.defaultInput as { block: string; difficulty: number; maxNonce: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;

        let expectedNonce = -1;
        for (let nonce = 0; nonce < input.maxNonce; nonce += 1) {
            const hash = powHash(input.block, nonce);
            let zeros = 0;
            while (zeros < hash.length && hash[zeros] === "0") {
                zeros += 1;
            }
            if (zeros >= input.difficulty) {
                expectedNonce = nonce;
                break;
            }
        }
        expect(expectedNonce).toBeGreaterThanOrEqual(0);
        expect(final?.["foundNonce"]).toBe(expectedNonce);
        expect(Number(final?.["trials"])).toBe(expectedNonce + 1);
        expect(final?.["foundHash"]).toBe(powHash(input.block, expectedNonce));
        expect(leadingZeros(String(final?.["foundHash"]))).toBeGreaterThanOrEqual(input.difficulty);
        expect(final?.["verified"]).toBe(true);

        for (let nonce = 0; nonce < expectedNonce; nonce += 1) {
            expect(leadingZeros(powHash(input.block, nonce))).toBeLessThan(input.difficulty);
        }
    });

    it("verifies difficulty zero at nonce zero and harder targets on new blocks", () => {
        for (const block of ["a", "block-9", "genesis"]) {
            const easy = [...mod.run({ block, difficulty: 0, maxNonce: 10 })];
            checkFrames(easy);
            expect(easy[easy.length - 1]?.meta["foundNonce"]).toBe(0);
            expect(easy[easy.length - 1]?.meta["verified"]).toBe(true);

            const harder = [...mod.run({ block, difficulty: 2, maxNonce: 200000 })];
            const final = harder[harder.length - 1]?.meta;
            expect(final?.["verified"]).toBe(true);
            expect(final?.["foundNonce"]).toBeGreaterThanOrEqual(0);
            expect(leadingZeros(String(final?.["foundHash"]))).toBeGreaterThanOrEqual(2);
        }
    });

    it("reports failure when the nonce cap is too small", () => {
        const frames = [...mod.run({ block: "small", difficulty: 4, maxNonce: 10 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["foundNonce"]).toBe(-1);
        expect(final?.["verified"]).toBe(false);
        expect(Number(final?.["trials"])).toBe(10);
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
