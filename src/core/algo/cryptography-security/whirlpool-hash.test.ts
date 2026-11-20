/**
 * whirlpool-hash.test.ts - Brute-force injectivity and collision checks,
 * determinism, frame shape checks, and termination for the toy Whirlpool core.
 */

import { describe, expect, it } from "vitest";
import mod, { SBOX, padMessage, wCipher, whirlpoolHash, whirlpoolRound } from "./whirlpool-hash";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(24);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(8);
        expect(typeof frame.meta["digest"]).toBe("string");
    });
}

function hex(bytes: number[]): string {
    return bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join("");
}

describe("Whirlpool toy compression", () => {
    it("uses a permutation S-box and invertible-looking round diffusion", () => {
        expect([...SBOX].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
        for (let value = 0; value < 16; value += 1) {
            expect(SBOX[SBOX[value]!] === undefined).toBe(false);
        }
        const key = [1, 2, 3, 4, 5, 6, 7, 8];
        const seen = new Set<string>();
        for (let i = 0; i < 1000; i += 1) {
            const state = Array.from({ length: 8 }, (_, j) => (i >>> (8 * j)) & 0xff);
            const out = wCipher(state, key);
            expect(out.length).toBe(8);
            expect(out.every((b) => b >= 0 && b <= 255)).toBe(true);
            expect(whirlpoolRound(state, key, 0).length).toBe(8);
            seen.add(hex(out));
        }
        expect(seen.size).toBe(1000);
    });

    it("pads to whole blocks and is deterministic", () => {
        expect(padMessage([]).length).toBe(1);
        expect(padMessage([1, 2, 3]).length).toBe(1);
        expect(padMessage([1, 2, 3])[0]).toEqual([1, 2, 3, 0x80, 0, 0, 0, 0]);
        expect(padMessage(Array(9).fill(1)).length).toBe(2);
        for (let i = 0; i < 30; i += 1) {
            const message = Array.from({ length: i * 3 }, (_, j) => (i + j * 7) & 0xff);
            expect(whirlpoolHash(message)).toEqual(whirlpoolHash(message));
            expect(whirlpoolHash(message).length).toBe(8);
        }
    });

    it("brute-forces all single-byte messages into distinct digests", () => {
        const seen = new Map<string, number>();
        for (let value = 0; value < 256; value += 1) {
            const digest = hex(whirlpoolHash([value]));
            expect(seen.has(digest)).toBe(false);
            seen.set(digest, value);
        }
        expect(seen.size).toBe(256);
        expect(whirlpoolHash([5])).not.toEqual(whirlpoolHash([6]));
    });

    it("emits well-formed frames matching a fresh digest", () => {
        const input = mod.defaultInput as { message: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["digest"]).toBe(hex(whirlpoolHash(input.message)));
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
