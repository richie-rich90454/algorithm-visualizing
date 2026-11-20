/**
 * gmac.test.ts - Algebraic property checks, independent tag replay, frame
 * shape checks, and termination for the GMAC/GHASH teaching core.
 */

import { describe, expect, it } from "vitest";
import mod, { blockToBytes, bytesToBlock, computeGmac, gfMul, ghash, padBlocks, toyBlock } from "./gmac";
import type { VisualFrame } from "@/types";

const MASK = (1n << 128n) - 1n;
const R = 0xe1000000000000000000000000000000n;

/** Byte-at-a-time reference multiplication, structured differently from gfMul. */
function referenceMul(x: bigint, y: bigint): bigint {
    let z = 0n;
    let v = y & MASK;
    for (let i = 15; i >= 0; i -= 1) {
        const byte = Number((x >> BigInt(8 * i)) & 0xffn);
        for (let bit = 7; bit >= 0; bit -= 1) {
            if ((byte >> bit) & 1) {
                z ^= v;
            }
            const lsb = v & 1n;
            v >>= 1n;
            if (lsb) {
                v ^= R;
            }
        }
    }
    return z & MASK;
}

function referenceTag(key: number, nonce: number, aad: number[], cipher: number[]): bigint {
    const h = toyBlock(0n, key);
    const blocks = [...padBlocks(aad), ...padBlocks(cipher), (BigInt(aad.length * 8) << 64n) | BigInt(cipher.length * 8)];
    let y = 0n;
    for (const block of blocks) {
        y = referenceMul(y ^ block, h);
    }
    return y ^ toyBlock(BigInt(nonce >>> 0), key ^ 0x5a);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(64);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(4);
        expect(frame.meta["cols"]).toBe(16);
        expect(typeof frame.meta["tag"]).toBe("string");
    });
}

describe("GMAC / GHASH teaching core", () => {
    it("satisfies field algebra properties against a reference multiplication", () => {
        const samples = [0n, 1n, 0xffn, 0x123456789abcdefn, MASK, 0xe1000000000000000000000000000000n];
        for (const x of samples) {
            for (const y of samples) {
                expect(gfMul(x, y)).toBe(referenceMul(x, y));
                // GCM uses a bit-reversed representation, so the multiplicative
                // identity is the top bit rather than the integer one.
                expect(gfMul(x, 0x80000000000000000000000000000000n)).toBe(x);
                expect(gfMul(0n, y)).toBe(0n);
            }
        }
        for (let i = 0; i < 40; i += 1) {
            const a = BigInt(i * 7919 + 13) & MASK;
            const b = BigInt(i * 104729 + 101) & MASK;
            const c = BigInt(i * 1299709 + 7) & MASK;
            expect(gfMul(a ^ b, c)).toBe(gfMul(a, c) ^ gfMul(b, c));
            expect(ghash(c, [a ^ b])).toBe(ghash(c, [a]) ^ ghash(c, [b]));
        }
    });

    it("round-trips block/byte conversions and pads to whole blocks", () => {
        for (let i = 0; i < 20; i += 1) {
            const bytes = Array.from({ length: 1 + i }, (_, j) => (j * 37 + i) & 0xff);
            const block = bytesToBlock(bytes);
            expect(blockToBytes(block).slice(0, Math.min(bytes.length, 16))).toEqual(bytes.slice(0, 16));
            expect(padBlocks(bytes).length).toBe(Math.ceil(bytes.length / 16));
        }
    });

    it("matches an independent tag replay and reacts to key, nonce, and data changes", () => {
        const input = mod.defaultInput as { key: number; nonce: number; aad: number[]; ciphertext: number[] };
        const expected = referenceTag(input.key, input.nonce, input.aad, input.ciphertext);
        expect(computeGmac(input.key, input.nonce, input.aad, input.ciphertext).tag).toBe(expected);
        expect(computeGmac(input.key + 1, input.nonce, input.aad, input.ciphertext).tag).not.toBe(expected);
        expect(computeGmac(input.key, input.nonce + 1, input.aad, input.ciphertext).tag).not.toBe(expected);
        expect(computeGmac(input.key, input.nonce, [...input.aad, 99], input.ciphertext).tag).not.toBe(expected);
        expect(computeGmac(input.key, input.nonce, input.aad, [input.ciphertext[0]! ^ 1, ...input.ciphertext.slice(1)]).tag).not.toBe(expected);
        expect(computeGmac(input.key, input.nonce, input.aad, input.ciphertext).tag).toBe(expected);
    });

    it("emits well-formed frames whose final accumulator is the reported GHASH value", () => {
        const input = mod.defaultInput as { key: number; nonce: number; aad: number[]; ciphertext: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = computeGmac(input.key, input.nonce, input.aad, input.ciphertext);
        const last = frames[frames.length - 1]!.meta;
        expect(last["ghash"]).toBe(expected.ghashValue.toString(16).toUpperCase().padStart(32, "0"));
        expect(last["tag"]).toBe(expected.tag.toString(16).toUpperCase().padStart(32, "0"));
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
