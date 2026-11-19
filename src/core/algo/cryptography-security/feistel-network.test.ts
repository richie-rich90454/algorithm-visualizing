/** feistel-network.test.ts - Invertibility over many blocks, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { feistelDecrypt, feistelEncrypt, makeRoundKeys, roundFunction } from "./feistel-network";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Feistel Network (toy)", () => {
    it("keeps the round function deterministic and in range", () => {
        for (let x = 0; x < 200; x += 1) {
            for (const key of [0, 1, 55, 65535]) {
                const value = roundFunction(x, key);
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(0xffff);
                expect(value).toBe(roundFunction(x, key));
            }
        }
        const seen = new Set<number>();
        for (let key = 0; key < 30; key += 1) {
            seen.add(roundFunction(1234, key));
        }
        expect(seen.size).toBeGreaterThan(20);
    });

    it("round-trips every block in an exhaustive small domain", () => {
        for (const seed of [0, 1, 42, 0xffff]) {
            for (const rounds of [1, 2, 4, 8]) {
                const keys = makeRoundKeys(seed, rounds);
                expect(keys.length).toBe(rounds);
                for (let left = 0; left < 48; left += 1) {
                    for (let right = 0; right < 48; right += 1) {
                        const cipher = feistelEncrypt(left, right, keys);
                        const plain = feistelDecrypt(cipher.left, cipher.right, keys);
                        expect(plain.left).toBe(left);
                        expect(plain.right).toBe(right);
                    }
                }
            }
        }
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["roundTrips"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
