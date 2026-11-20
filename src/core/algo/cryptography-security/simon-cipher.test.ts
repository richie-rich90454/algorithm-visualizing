/**
 * simon-cipher.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./simon-cipher";
import type { VisualFrame } from "@/types";

interface Input {
    key: number[];
    block: number;
    mode: string;
}

/** Independent word rotation written with explicit bit slicing. */
function rotateRight(value: number, j: number): number {
    const x = value & 0xffff;
    return ((x & ((1 << j) - 1)) << (16 - j)) | (x >>> j);
}

/** Independent left rotation used by the Simon round function. */
function rotateLeft(value: number, j: number): number {
    const x = value & 0xffff;
    return ((x << j) | (x >>> (16 - j))) & 0xffff;
}

/** Independent Simon round function. */
function f(x: number): number {
    return ((rotateLeft(x, 1) & rotateLeft(x, 8)) ^ rotateLeft(x, 2)) & 0xffff;
}

const Z0 = "11111010001001010110000111001101111101000100101011000011100110";

/** Independent key expansion following the published four-word recurrence. */
function expand(seed: number[]): number[] {
    const keys = seed.slice(0, 4).map((w) => w & 0xffff);
    for (let i = 0; keys.length < 32; i += 1) {
        const inner = rotateRight(keys[i + 3]!, 3) ^ keys[i + 1]!;
        const bit = Z0[i % Z0.length] === "1" ? 1 : 0;
        keys.push((0xfffc ^ bit ^ keys[i]! ^ inner ^ rotateRight(inner, 1)) & 0xffff);
    }
    return keys;
}

/** Reference encryption of one 32-bit block. */
function encrypt(key: number[], block: number): number {
    const rk = expand(key);
    let x = (block >>> 16) & 0xffff;
    let y = block & 0xffff;
    for (let i = 0; i < 32; i += 1) {
        const next = (y ^ f(x) ^ rk[i]!) & 0xffff;
        y = x;
        x = next;
    }
    return ((x << 16) | y) >>> 0;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Simon 32/64 Block Cipher", () => {
    const input = mod.defaultInput as Input;

    it("matches the published key expansion and test vector", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["roundKeys"]).toEqual(expand(input.key));
        expect(final?.["output"]).toBe(encrypt(input.key, input.block));
        expect(final?.["output"]).toBe(0xc69be9bb);
    });

    it("round-trips random blocks under random keys", () => {
        let seed = 31337;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const key = [rand() & 0xffff, rand() & 0xffff, rand() & 0xffff, rand() & 0xffff];
            const block = (rand() << 16 | rand()) >>> 0;
            const cipherFrames = [...mod.run({ key, block, mode: "encrypt" })];
            const cipher = cipherFrames[cipherFrames.length - 1]?.meta["output"] as number;
            expect(cipher).toBe(encrypt(key, block));
            const decryptFrames = [...mod.run({ key, block: cipher, mode: "decrypt" })];
            checkFrames(decryptFrames);
            expect(decryptFrames[decryptFrames.length - 1]?.meta["output"]).toBe(block);
        }
    });

    it("is a bijection on a small exhaustive sample of blocks", () => {
        const key = [0x1212, 0x3434, 0x5656, 0x7878];
        const seen = new Set<number>();
        for (let low = 0; low < 256; low += 1) {
            const block = (0x1234 << 16) | low;
            seen.add(encrypt(key, block));
        }
        expect(seen.size).toBe(256);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
