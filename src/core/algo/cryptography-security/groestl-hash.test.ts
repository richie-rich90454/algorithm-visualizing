/**
 * groestl-hash.test.ts - Brute-force injectivity, collision, and permutation
 * distinction checks, determinism, frame shape checks, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { SBOX, groestlHash, groestlPermute, groestlRound, padMessage } from "./groestl-hash";
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

describe("Groestl toy permutations", () => {
    it("uses a permutation S-box and two distinct injective variants", () => {
        expect([...SBOX].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
        const key = [9, 8, 7, 6, 5, 4, 3, 2];
        const pSeen = new Set<string>();
        const qSeen = new Set<string>();
        let differences = 0;
        for (let i = 0; i < 1000; i += 1) {
            const state = Array.from({ length: 8 }, (_, j) => (i >>> (8 * j)) & 0xff);
            const p = groestlPermute(state, key, "P");
            const q = groestlPermute(state, key, "Q");
            expect(p.length).toBe(8);
            expect(groestlRound(state, key, 0, "P").length).toBe(8);
            pSeen.add(hex(p));
            qSeen.add(hex(q));
            if (hex(p) !== hex(q)) differences += 1;
        }
        expect(pSeen.size).toBe(1000);
        expect(qSeen.size).toBe(1000);
        expect(differences).toBeGreaterThan(990);
    });

    it("pads and hashes deterministically", () => {
        expect(padMessage([]).length).toBe(1);
        expect(padMessage([1, 2, 3])[0]).toEqual([1, 2, 3, 0x80, 0, 0, 0, 0]);
        expect(padMessage(Array(8).fill(7)).length).toBe(2);
        for (let i = 0; i < 30; i += 1) {
            const message = Array.from({ length: i * 2 }, (_, j) => (i * 13 + j * 3) & 0xff);
            expect(groestlHash(message)).toEqual(groestlHash(message));
            expect(groestlHash(message).length).toBe(8);
        }
    });

    it("brute-forces all single-byte messages into distinct digests", () => {
        const seen = new Set<string>();
        for (let value = 0; value < 256; value += 1) {
            const digest = hex(groestlHash([value]));
            expect(seen.has(digest)).toBe(false);
            seen.add(digest);
        }
        expect(seen.size).toBe(256);
        expect(groestlHash([1, 2])).not.toEqual(groestlHash([2, 1]));
    });

    it("emits well-formed frames matching a fresh digest", () => {
        const input = mod.defaultInput as { message: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["digest"]).toBe(hex(groestlHash(input.message)));
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
