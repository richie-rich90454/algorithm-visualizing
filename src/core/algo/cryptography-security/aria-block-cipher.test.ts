/** aria-block-cipher.test.ts - Independent SPN replay, S-box bijection, round trip, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./aria-block-cipher";
import type { VisualFrame } from "@/types";

interface Input {
    block: number[];
    key: number[];
    rounds: number;
    mode: "encrypt" | "decrypt";
}

const PERMUTATION = [0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12, 1, 6, 11];

function gmul(a: number, b: number): number {
    let product = 0;
    let x = a & 0xff;
    let y = b & 0xff;
    for (let i = 0; i < 8; i += 1) {
        if (y & 1) {
            product ^= x;
        }
        const carry = x & 0x80;
        x = (x << 1) & 0xff;
        if (carry) {
            x ^= 0x1b;
        }
        y >>>= 1;
    }
    return product;
}

function inverseOf(value: number): number {
    if (value === 0) {
        return 0;
    }
    let result = 1;
    let base = value;
    let exponent = 254;
    while (exponent > 0) {
        if (exponent & 1) {
            result = gmul(result, base);
        }
        base = gmul(base, base);
        exponent >>>= 1;
    }
    return result;
}

const SBOX = Array.from({ length: 256 }, (_, value) => (gmul(inverseOf(value), 0x2d) ^ 0x5a) & 0xff);
const INV_SBOX: number[] = new Array(256);
SBOX.forEach((value, index) => {
    INV_SBOX[value] = index;
});

function diffuse(state: number[]): number[] {
    const permuted = PERMUTATION.map((index) => state[index]!);
    const out: number[] = new Array(16);
    for (let i = 0; i < 15; i += 1) {
        out[i] = permuted[i] ^ permuted[i + 1];
    }
    out[15] = permuted[15];
    return out;
}

function diffuseInverse(state: number[]): number[] {
    const permuted: number[] = new Array(16);
    permuted[15] = state[15]!;
    for (let i = 14; i >= 0; i -= 1) {
        permuted[i] = state[i]! ^ permuted[i + 1]!;
    }
    const out: number[] = new Array(16);
    PERMUTATION.forEach((source, index) => {
        out[source] = permuted[index]!;
    });
    return out;
}

function expandKey(key: number[], rounds: number): number[][] {
    let seed = 0x13579bdf;
    for (const byte of key) {
        seed = (Math.imul(seed ^ byte, 0x27d4eb2d) + 0x165667b1) >>> 0;
    }
    return Array.from({ length: rounds + 1 }, () =>
        Array.from({ length: 16 }, () => {
            seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
            return (seed >>> 17) & 0xff;
        }),
    );
}

function reference(input: Input): number[] {
    const keys = expandKey(input.key, input.rounds);
    let state = input.block.slice(0, 16);
    while (state.length < 16) {
        state.push(0);
    }
    if (input.mode === "encrypt") {
        for (let round = 0; round < input.rounds; round += 1) {
            state = state.map((value) => SBOX[value]!);
            state = diffuse(state);
            state = state.map((value, index) => value ^ keys[round]![index]!);
        }
        state = state.map((value, index) => value ^ keys[input.rounds]![index]!);
    } else {
        state = state.map((value, index) => value ^ keys[input.rounds]![index]!);
        for (let round = input.rounds - 1; round >= 0; round -= 1) {
            state = state.map((value, index) => value ^ keys[round]![index]!);
            state = diffuseInverse(state);
            state = state.map((value) => INV_SBOX[value]!);
        }
    }
    return state;
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
        expect(frame.entities.length).toBe(16);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("AriaBlockCipher", () => {
    const base: Input = {
        block: Array.from({ length: 16 }, (_, index) => (index * 17) & 0xff),
        key: [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07],
        rounds: 4,
        mode: "encrypt",
    };

    it("matches an independent substitution-permutation replay", () => {
        const inputs: Input[] = [
            base,
            { ...base, block: Array.from({ length: 16 }, (_, index) => index), rounds: 3 },
            { ...base, key: [1, 2, 3, 4, 5], rounds: 6 },
        ];
        for (const input of inputs) {
            checkFrames([...mod.run(input)]);
            expect(outputOf(input)).toEqual(reference(input));
        }
    });

    it("uses a bijective S-box and an invertible diffusion layer", () => {
        expect(new Set(SBOX).size).toBe(256);
        for (let value = 0; value < 256; value += 1) {
            expect(INV_SBOX[SBOX[value]!]).toBe(value);
        }
        const sample = Array.from({ length: 16 }, (_, index) => (index * 23 + 5) & 0xff);
        expect(diffuseInverse(diffuse(sample))).toEqual(sample);
    });

    it("recovers the plaintext on decryption for many blocks", () => {
        for (let variant = 0; variant < 8; variant += 1) {
            const block = Array.from({ length: 16 }, (_, index) => (variant * 37 + index * 13) & 0xff);
            const ciphertext = outputOf({ ...base, block });
            expect(outputOf({ ...base, block: ciphertext, mode: "decrypt" })).toEqual(block);
        }
    });

    it("changes the ciphertext when the key changes and terminates", () => {
        expect(outputOf({ ...base, key: [0xff, 0x01, 0x02, 0x03] })).not.toEqual(outputOf(base));
        const generator = mod.run(base);
        expect([...generator].length).toBe(base.rounds + 2);
        expect(generator.next().done).toBe(true);
    });
});
