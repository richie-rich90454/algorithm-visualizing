/**
 * triple-des.test.ts - Independent Feistel EDE reference, exhaustive round
 * trip, frame shape, and termination checks. Tests a toy model, not real DES.
 */

import { describe, expect, it } from "vitest";
import mod from "./triple-des";
import type { VisualFrame } from "@/types";

const SBOX = [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7];

function subkeys(key: number): number[] {
    const hi = (key >> 4) & 15;
    const lo = key & 15;
    return [hi, lo, (hi + lo) & 15, (hi + 2 * lo + 1) & 15];
}

function feistel(block: number, keys: number[], decrypt: boolean): number {
    let L = decrypt ? block & 15 : (block >> 4) & 15;
    let R = decrypt ? (block >> 4) & 15 : block & 15;
    const ks = decrypt ? [...keys].reverse() : keys;
    for (const k of ks) {
        const f = SBOX[(R ^ k) & 15] ?? 0;
        const nL = R;
        const nR = L ^ f;
        L = nL;
        R = nR;
    }
    return decrypt ? ((R << 4) | L) & 255 : ((L << 4) | R) & 255;
}

function ede(p: number, k1: number, k2: number): number {
    return feistel(feistel(feistel(p, subkeys(k1), false), subkeys(k2), true), subkeys(k1), false);
}

function dede(c: number, k1: number, k2: number): number {
    return feistel(feistel(feistel(c, subkeys(k1), true), subkeys(k2), false), subkeys(k1), true);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("TripleDesToy", () => {
    it("matches an independent Feistel EDE implementation", () => {
        for (const [p, k1, k2] of [
            [0xA5, 0x12, 0x34],
            [0x00, 0x00, 0x00],
            [0xFF, 0xAB, 0xCD],
            [0x5A, 0xF0, 0x0F],
        ]) {
            const frames = [...mod.run({ plaintext: p, k1, k2 })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            expect(Number(final?.meta["ciphertext"])).toBe(ede(p, k1, k2));
            expect(Number(final?.meta["recovered"])).toBe(dede(ede(p, k1, k2), k1, k2));
            expect(final?.meta["valid"]).toBe(true);
            expect(final?.meta["subkeys1"]).toEqual(subkeys(k1));
            expect(final?.meta["subkeys2"]).toEqual(subkeys(k2));
        }
    });

    it("round-trips every plaintext byte under several key pairs", () => {
        const keys: Array<[number, number]> = [[0x12, 0x34], [0x00, 0x00], [0xFF, 0x01]];
        for (const [k1, k2] of keys) {
            for (let p = 0; p < 256; p += 1) {
                const frames = [...mod.run({ plaintext: p, k1, k2 })];
                const final = frames[frames.length - 1];
                expect(Number(final?.meta["recovered"])).toBe(p);
                expect(final?.meta["valid"]).toBe(true);
            }
        }
    });

    it("does not accidentally equal a single Feistel call for the default case", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1];
        const p = 0xA5;
        const k1 = 0x12;
        expect(Number(final?.meta["ciphertext"])).not.toBe(feistel(p, subkeys(k1), false));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
