/** speck-cipher.test.ts - Independent ARX reference, invertibility over random inputs, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./speck-cipher";
import type { VisualFrame } from "@/types";

function rotl(v: number, s: number): number { return (((v << s) | (v >>> (8 - s))) & 0xff); }
function rotr(v: number, s: number): number { return (((v >>> s) | (v << (8 - s))) & 0xff); }
function schedule(key: number, rounds: number): Array<[number, number]> {
    let a = (key >>> 8) & 0xff;
    let b = key & 0xff;
    const k: Array<[number, number]> = [];
    for (let i = 0; i < rounds; i += 1) {
        a = (rotr(a, 3) + b) & 0xff;
        b = rotl(b, 2) ^ a;
        k.push([a, b]);
    }
    return k;
}
function enc(block: number, key: number, rounds: number): number {
    const k = schedule(key, rounds);
    let x = (block >>> 8) & 0xff;
    let y = block & 0xff;
    for (const [ka, kb] of k) {
        let a = rotr(x, 3);
        a = (a + y) & 0xff;
        const b = rotl(y, 2) ^ a;
        x = a ^ (ka ?? 0);
        y = b ^ (kb ?? 0);
    }
    return ((x << 8) | y) & 0xffff;
}
function dec(block: number, key: number, rounds: number): number {
    const k = schedule(key, rounds);
    let x = (block >>> 8) & 0xff;
    let y = block & 0xff;
    for (let i = rounds - 1; i >= 0; i -= 1) {
        const [ka, kb] = k[i] ?? [0, 0];
        const a2 = x ^ (ka ?? 0);
        const b2 = y ^ (kb ?? 0);
        const oy = rotr(b2 ^ a2, 2);
        const ox = rotl((a2 - oy + 256) & 0xff, 3);
        x = ox;
        y = oy;
    }
    return ((x << 8) | y) & 0xffff;
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

describe("SpeckCipher", () => {
    it("matches an independent ARX reference on fixed vectors", () => {
        for (const input of [
            { block: 0x1234, key: 0xabcd, rounds: 8 },
            { block: 0x0000, key: 0x0000, rounds: 1 },
            { block: 0xffff, key: 0x1234, rounds: 12 },
        ]) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.rounds);
            expect(frames[frames.length - 1]?.meta["ciphertext"]).toBe(
                enc(input.block, input.key, input.rounds).toString(16),
            );
        }
    });

    it("inverts random blocks and keys for many round counts", () => {
        let seed = 131;
        for (let trial = 0; trial < 60; trial += 1) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const block = seed & 0xffff;
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const key = seed & 0xffff;
            const rounds = 1 + (trial % 12);
            expect(dec(enc(block, key, rounds), key, rounds)).toBe(block);
            const frames = [...mod.run({ block, key, rounds })];
            checkFrames(frames, rounds);
            expect(Number.parseInt(String(frames[frames.length - 1]?.meta["plaintext"]), 16)).toBe(block);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});
