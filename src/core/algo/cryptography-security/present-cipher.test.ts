/** present-cipher.test.ts - Independent cipher, invertibility over random blocks, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./present-cipher";
import type { VisualFrame } from "@/types";

const SBOX = [0xc, 0x5, 0xb, 0xf, 0x7, 0x8, 0x6, 0xd, 0x3, 0xa, 0x0, 0x9, 0xe, 0x4, 0x2, 0x1];
const INV: number[] = [];
SBOX.forEach((v, i) => { INV[v] = i; });
const PERM = [0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15];

function rk(key: number, r: number): number {
    const rot = ((r * 3) % 16 + 16) % 16;
    return ((((key << rot) | (key >>> (16 - rot))) & 0xffff) ^ ((r * 0x2a) & 0xffff)) & 0xffff;
}
function nib(b: number, i: number): number { return (b >>> (i * 4)) & 0xf; }
function setN(b: number, i: number, v: number): number {
    return (b & ~(0xf << (i * 4))) | ((v & 0xf) << (i * 4));
}
function sboxLayer(b: number): number {
    let o = 0;
    for (let i = 0; i < 4; i += 1) { o = setN(o, i, SBOX[nib(b, i)] ?? 0); }
    return o;
}
function invSboxLayer(b: number): number {
    let o = 0;
    for (let i = 0; i < 4; i += 1) { o = setN(o, i, INV[nib(b, i)] ?? 0); }
    return o;
}
function perm(b: number, table: number[]): number {
    let o = 0;
    for (let i = 0; i < 16; i += 1) { if ((b >>> i) & 1) { o |= 1 << (table[i] ?? 0); } }
    return o & 0xffff;
}
function enc(b: number, key: number, rounds: number): number {
    let s = b;
    for (let r = 1; r <= rounds; r += 1) { s = perm(sboxLayer(s ^ rk(key, r)), PERM); }
    return s ^ rk(key, rounds + 1);
}
function dec(b: number, key: number, rounds: number): number {
    let s = b ^ rk(key, rounds + 1);
    for (let r = rounds; r >= 1; r -= 1) { s = invSboxLayer(perm(s, PERM)) ^ rk(key, r); }
    return s;
}

function checkFrames(frames: VisualFrame[], rounds: number): void {
    expect(frames.length).toBe(rounds + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe((rounds + 1) * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("PresentCipher", () => {
    it("matches an independent reference on fixed vectors", () => {
        for (const input of [
            { block: 0x1234, key: 0xabcd, rounds: 4 },
            { block: 0x0000, key: 0x0000, rounds: 1 },
            { block: 0xffff, key: 0x1234, rounds: 6 },
        ]) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.rounds);
            expect(frames[frames.length - 1]?.meta["ciphertext"]).toBe(
                enc(input.block, input.key, input.rounds).toString(16),
            );
        }
    });

    it("inverts every random block and key across several round counts", () => {
        let seed = 97;
        for (let trial = 0; trial < 60; trial += 1) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const block = seed & 0xffff;
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const key = seed & 0xffff;
            const rounds = 1 + (trial % 8);
            const expected = enc(block, key, rounds);
            expect(dec(expected, key, rounds)).toBe(block);
            const frames = [...mod.run({ block, key, rounds })];
            checkFrames(frames, rounds);
            expect(Number.parseInt(String(frames[frames.length - 1]?.meta["plaintext"]), 16)).toBe(block);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
