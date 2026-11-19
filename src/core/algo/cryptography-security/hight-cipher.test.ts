/** hight-cipher.test.ts - Independent branch replay, round trip, key sensitivity, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./hight-cipher";
import type { VisualFrame } from "@/types";

interface Input {
    block: number[];
    key: number[];
    rounds: number;
    mode: "encrypt" | "decrypt";
}

const MASK = 0xff;

function expandReference(key: number[], rounds: number): number[][] {
    let state = 0x9e3779b9;
    for (const byte of key) {
        state = (Math.imul(state ^ byte, 0x85ebca6b) + 0x27d4eb2d) >>> 0;
    }
    return Array.from({ length: rounds }, () =>
        Array.from({ length: 16 }, () => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return (state >>> 13) & MASK;
        }),
    );
}

function forward(bytes: number[], keys: number[], round: number): number[] {
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i < 4; i += 1) {
        left.push((bytes[i] + ((bytes[4 + i] ^ keys[i]) & MASK)) & MASK);
    }
    for (let i = 0; i < 4; i += 1) {
        right.push((bytes[4 + i] - (left[i] ^ keys[4 + i])) & MASK);
    }
    const mixed = [...left, ...right].map((value, index) => value ^ keys[8 + index] ^ (round & MASK));
    return Array.from({ length: 8 }, (_, index) => mixed[(index + 7) % 8]!);
}

function inverse(bytes: number[], keys: number[], round: number): number[] {
    const mixed = Array.from({ length: 8 }, (_, index) => bytes[(index + 1) % 8]!);
    const left: number[] = [];
    const right: number[] = [];
    for (let i = 0; i < 4; i += 1) {
        left.push(mixed[i] ^ keys[8 + i] ^ (round & MASK));
    }
    for (let i = 0; i < 4; i += 1) {
        right.push(mixed[4 + i] ^ keys[12 + i] ^ (round & MASK));
    }
    const original: number[] = [];
    for (let i = 0; i < 4; i += 1) {
        original[4 + i] = (right[i] + (left[i] ^ keys[4 + i])) & MASK;
    }
    for (let i = 0; i < 4; i += 1) {
        original[i] = (left[i] - (original[4 + i] ^ keys[i])) & MASK;
    }
    return original;
}

function reference(input: Input): number[] {
    const keys = expandReference(input.key, input.rounds);
    let state = input.block.slice(0, 8);
    while (state.length < 8) {
        state.push(0);
    }
    if (input.mode === "encrypt") {
        for (let round = 0; round < input.rounds; round += 1) {
            state = forward(state, keys[round]!, round);
        }
    } else {
        for (let round = input.rounds - 1; round >= 0; round -= 1) {
            state = inverse(state, keys[round]!, round);
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
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("HightCipher", () => {
    const base: Input = {
        block: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef],
        key: [0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77],
        rounds: 8,
        mode: "encrypt",
    };

    it("matches an independent eight-branch replay", () => {
        const inputs: Input[] = [
            base,
            { ...base, block: [0, 1, 2, 3, 4, 5, 6, 7], rounds: 5 },
            { ...base, key: [1, 2, 3, 4], rounds: 12 },
        ];
        for (const input of inputs) {
            checkFrames([...mod.run(input)]);
            expect(outputOf(input)).toEqual(reference(input));
        }
    });

    it("recovers the plaintext on decryption for many blocks", () => {
        for (let variant = 0; variant < 8; variant += 1) {
            const block = Array.from({ length: 8 }, (_, index) => (variant * 29 + index * 19) & 0xff);
            const ciphertext = outputOf({ ...base, block });
            expect(outputOf({ ...base, block: ciphertext, mode: "decrypt" })).toEqual(block);
        }
    });

    it("changes the ciphertext when the key changes", () => {
        expect(outputOf({ ...base, key: [0xff, 0x11, 0x22, 0x33] })).not.toEqual(outputOf(base));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(base);
        expect([...generator].length).toBe(base.rounds + 2);
        expect(generator.next().done).toBe(true);
    });
});
