/**
 * benaloh.test.ts - Exhaustive decryption and homomorphism property, frame
 * shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { makeKey, encrypt, decrypt, add } from "./benaloh";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["toy"]).toBe(true);
    });
}

describe("Benaloh Encryption", () => {
    it("decrypts every message and blinder in the full toy space", () => {
        const key = makeKey(11, 5, 2, 2);
        for (let message = 0; message < 5; message += 1) {
            for (let randomness = 0; randomness < 5; randomness += 1) {
                const ciphertext = encrypt(message, randomness, key);
                expect(decrypt(ciphertext, key)).toBe(message);
            }
        }
    });

    it("is additively homomorphic for every pair of messages", () => {
        const key = makeKey(11, 5, 2, 2);
        for (let first = 0; first < 5; first += 1) {
            for (let second = 0; second < 5; second += 1) {
                const combined = add(encrypt(first, 1, key), encrypt(second, 3, key), key.p);
                expect(decrypt(combined, key)).toBe((first + second) % 5);
            }
        }
    });

    it("reports correct verdicts on the default input frames", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const input = mod.defaultInput as { message: number; randomness: number; otherMessage: number; otherRandomness: number };
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["recovered"]).toBe(input.message);
        expect(final?.["homomorphic"]).toBe(true);
        expect(final?.["combined"]).toBe(
            add(
                encrypt(input.message, input.randomness, makeKey(11, 5, 2, 2)),
                encrypt(input.otherMessage, input.otherRandomness, makeKey(11, 5, 2, 2)),
                11,
            ),
        );
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
