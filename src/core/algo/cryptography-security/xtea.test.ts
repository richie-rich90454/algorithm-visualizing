/**
 * xtea.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./xtea";
import type { VisualFrame } from "@/types";

const DELTA = 0x9e3779b9;

/** Independent XTEA implementation with explicit 32-bit wrapping. */
function reference(v0: number, v1: number, key: number[], rounds: number): [number, number] {
    const wrap = (x: number): number => x >>> 0;
    const mixR = (word: number, sum: number, keyWord: number): number =>
        wrap((((word << 4) ^ (word >>> 5)) + word) ^ (sum + keyWord));
    let a = wrap(v0);
    let b = wrap(v1);
    let sum = 0;
    for (let i = 0; i < rounds; i += 1) {
        a = wrap(a + mixR(b, sum, key[sum & 3] ?? 0));
        sum = wrap(sum + DELTA);
        b = wrap(b + mixR(a, sum, key[(sum >>> 11) & 3] ?? 0));
    }
    return [a, b];
}

/** Inverse of the reference encryption. */
function decrypt(v0: number, v1: number, key: number[], rounds: number): [number, number] {
    const wrap = (x: number): number => x >>> 0;
    const mixR = (word: number, sum: number, keyWord: number): number =>
        wrap((((word << 4) ^ (word >>> 5)) + word) ^ (sum + keyWord));
    let a = wrap(v0);
    let b = wrap(v1);
    let sum = wrap(DELTA * rounds);
    for (let i = 0; i < rounds; i += 1) {
        b = wrap(b - mixR(a, sum, key[(sum >>> 11) & 3] ?? 0));
        sum = wrap(sum - DELTA);
        a = wrap(a - mixR(b, sum, key[sum & 3] ?? 0));
    }
    return [a, b];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(6);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("XTEA", () => {
    it("matches an independent implementation across several blocks and round counts", () => {
        const cases: Array<{ words: [number, number]; key: number[]; rounds: number }> = [
            { words: [0x8e73b0f7, 0xda0e6452], key: [0x03020100, 0x07060504, 0x0b0a0908, 0x0f0e0d0c], rounds: 8 },
            { words: [1234, 5678], key: [9, 8, 7, 6], rounds: 4 },
            { words: [0xffffffff, 0], key: [1, 2, 3, 4], rounds: 12 },
            { words: [0, 0], key: [0, 0, 0, 0], rounds: 6 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(testCase.words[0], testCase.words[1], testCase.key, testCase.rounds);
            expect(Number(final?.["v0"])).toBe(expected[0]);
            expect(Number(final?.["v1"])).toBe(expected[1]);
            expect(final?.["ciphertext"]).toBe(
                expected[0].toString(16).padStart(8, "0") + expected[1].toString(16).padStart(8, "0"),
            );
        }
    });

    it("round-trips encryption and decryption", () => {
        const blocks: Array<[number, number]> = [
            [0x12345678, 0x9abcdef0],
            [0, 1],
            [0xdeadbeef, 0xcafebabe],
        ];
        const key = [0x11223344, 0x55667788, 0x99aabbcc, 0xddeeff00];
        for (const [a, b] of blocks) {
            const [c0, c1] = reference(a, b, key, 16);
            expect(decrypt(c0, c1, key, 16)).toEqual([a >>> 0, b >>> 0]);
        }
    });

    it("produces different ciphertext for a different key", () => {
        const words: [number, number] = [0x01234567, 0x89abcdef];
        const first = [...mod.run({ words, key: [1, 2, 3, 4], rounds: 8 })].slice(-1)[0]?.meta["ciphertext"];
        const second = [...mod.run({ words, key: [1, 2, 3, 5], rounds: 8 })].slice(-1)[0]?.meta["ciphertext"];
        expect(first).not.toBe(second);
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
