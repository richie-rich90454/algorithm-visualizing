/** kalyna.test.ts - Independent Feistel replay, S-box bijection, round trip, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./kalyna";
import type { VisualFrame } from "@/types";

interface Input {
    block: number[];
    key: number[];
    rounds: number;
    mode: "encrypt" | "decrypt";
}

const MASK = 0xffffffff;
const sbox = (byte: number): number => ((((byte ^ 0x5a) * 13) + 7) >>> 0) & 0xff;
const inverseSbox = (byte: number): number => (((byte - 7 + 256) * 197) & 0xff) ^ 0x5a;
const rotl = (x: number, n: number): number => ((x << n) | (x >>> (32 - n))) >>> 0;
const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;

function substitute(word: number, inverse = false): number {
    let out = 0;
    for (let i = 0; i < 4; i += 1) {
        const byte = (word >>> (8 * i)) & 0xff;
        out |= (inverse ? inverseSbox(byte) : sbox(byte)) << (8 * i);
    }
    return out >>> 0;
}

function expandKey(key: number[], rounds: number) {
    let seed = 0xa5a5f00d;
    for (const byte of key) {
        seed = (Math.imul(seed ^ byte, 0x9e3779b1) + 0x85ebca6b) >>> 0;
    }
    const next = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed >>> 0;
    };
    return Array.from({ length: rounds }, () => ({ add: next(), xor: next(), rotation: next() % 32 }));
}

function reference(input: Input): number[] {
    const keys = expandKey(input.key, input.rounds);
    let left = 0;
    let right = 0;
    for (let i = 0; i < 4; i += 1) {
        left |= (input.block[i] ?? 0) << (8 * i);
        right |= (input.block[4 + i] ?? 0) << (8 * i);
    }
    left >>>= 0;
    right >>>= 0;
    const roundFunction = (value: number, key: (typeof keys)[number]): number =>
        rotl(substitute((((value + key.add) >>> 0) ^ key.xor) >>> 0), key.rotation);
    if (input.mode === "encrypt") {
        for (let round = 0; round < input.rounds; round += 1) {
            const key = keys[round]!;
            const mixed = (right ^ roundFunction(left, key)) >>> 0;
            right = left;
            left = mixed;
        }
    } else {
        for (let round = input.rounds - 1; round >= 0; round -= 1) {
            const key = keys[round]!;
            const originalRight = (left ^ roundFunction(right, key)) >>> 0;
            left = right;
            right = originalRight;
        }
    }
    const out: number[] = [];
    for (let i = 0; i < 4; i += 1) {
        out.push((left >>> (8 * i)) & 0xff);
    }
    for (let i = 0; i < 4; i += 1) {
        out.push((right >>> (8 * i)) & 0xff);
    }
    return out;
}

function outputOf(input: Input): number[] {
    const frames = [...mod.run(input)];
    return frames[frames.length - 1]?.meta["output"] as number[];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Kalyna", () => {
    const base: Input = {
        block: [0, 1, 2, 3, 4, 5, 6, 7],
        key: [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80],
        rounds: 8,
        mode: "encrypt",
    };

    it("matches an independent Feistel replay", () => {
        const inputs: Input[] = [
            base,
            { ...base, block: [0xff, 0x01, 0x33, 0x55, 0x77, 0x99, 0xbb, 0xdd], rounds: 4 },
            { ...base, key: [1, 2, 3], rounds: 12 },
        ];
        for (const input of inputs) {
            checkFrames([...mod.run(input)]);
            expect(outputOf(input)).toEqual(reference(input));
        }
    });

    it("uses a bijective byte substitution", () => {
        const seen = new Set<number>();
        for (let value = 0; value < 256; value += 1) {
            seen.add(sbox(value));
            expect(inverseSbox(sbox(value))).toBe(value);
        }
        expect(seen.size).toBe(256);
    });

    it("recovers the plaintext on decryption for many blocks", () => {
        for (let variant = 0; variant < 8; variant += 1) {
            const block = Array.from({ length: 8 }, (_, index) => (variant * 41 + index * 23) & 0xff);
            const ciphertext = outputOf({ ...base, block });
            expect(outputOf({ ...base, block: ciphertext, mode: "decrypt" })).toEqual(block);
        }
    });

    it("changes the ciphertext when the key changes and terminates", () => {
        expect(outputOf({ ...base, key: [0xff, 0x20, 0x30, 0x40] })).not.toEqual(outputOf(base));
        const generator = mod.run(base);
        expect([...generator].length).toBe(base.rounds + 2);
        expect(generator.next().done).toBe(true);
    });
});
