/** cast-256.test.ts - Independent CAST replay, round trip, key sensitivity, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./cast-256";
import type { VisualFrame } from "@/types";

interface Input {
    block: number[];
    key: number[];
    rounds: number;
    mode: "encrypt" | "decrypt";
}

const rotl = (x: number, n: number): number => ((x << n) | (x >>> (32 - n))) >>> 0;

function reference(input: Input): number[] {
    let seed = 0x2f1e3d4c;
    for (const byte of input.key) {
        seed = (Math.imul(seed ^ byte, 0x7feb352d) + 0x846ca68b) >>> 0;
    }
    const keySeed = seed;
    const next = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed;
    };
    const sboxes = Array.from({ length: 4 }, () => Array.from({ length: 256 }, () => next()));
    seed = keySeed;
    const roundKeys = Array.from({ length: input.rounds }, () => {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        return seed >>> 0;
    });
    const f = (x: number, key: number): number => {
        const sum = (x + key) >>> 0;
        const rotated = rotl(sum, sum % 32);
        const a = (rotated >>> 24) & 0xff;
        const b = (rotated >>> 16) & 0xff;
        const c = (rotated >>> 8) & 0xff;
        const d = rotated & 0xff;
        const first = sboxes[0]![a]! ^ sboxes[1]![b]!;
        return ((((first - sboxes[2]![c]!) >>> 0) + sboxes[3]![d]!) >>> 0);
    };
    let left = 0;
    let right = 0;
    for (let i = 0; i < 4; i += 1) {
        left |= (input.block[i] ?? 0) << (8 * i);
        right |= (input.block[4 + i] ?? 0) << (8 * i);
    }
    left >>>= 0;
    right >>>= 0;
    const order =
        input.mode === "encrypt"
            ? Array.from({ length: input.rounds }, (_, index) => index)
            : Array.from({ length: input.rounds }, (_, index) => input.rounds - 1 - index);
    for (const round of order) {
        if (input.mode === "encrypt") {
            const mixed = (right ^ f(left, roundKeys[round]!)) >>> 0;
            right = left;
            left = mixed;
        } else {
            const originalRight = (left ^ f(right, roundKeys[round]!)) >>> 0;
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

describe("Cast256", () => {
    const base: Input = {
        block: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef],
        key: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08],
        rounds: 6,
        mode: "encrypt",
    };

    it("matches an independent CAST Feistel replay", () => {
        const inputs: Input[] = [
            base,
            { ...base, block: [0, 1, 2, 3, 4, 5, 6, 7], rounds: 4 },
            { ...base, key: [1, 2, 3], rounds: 8 },
        ];
        for (const input of inputs) {
            checkFrames([...mod.run(input)]);
            expect(outputOf(input)).toEqual(reference(input));
        }
    });

    it("recovers the plaintext on decryption for many blocks", () => {
        for (let variant = 0; variant < 8; variant += 1) {
            const block = Array.from({ length: 8 }, (_, index) => (variant * 47 + index * 29) & 0xff);
            const ciphertext = outputOf({ ...base, block });
            expect(outputOf({ ...base, block: ciphertext, mode: "decrypt" })).toEqual(block);
        }
    });

    it("changes the ciphertext when the key changes and terminates", () => {
        expect(outputOf({ ...base, key: [0xff, 0x02, 0x03, 0x04] })).not.toEqual(outputOf(base));
        const generator = mod.run(base);
        expect([...generator].length).toBe(base.rounds + 2);
        expect(generator.next().done).toBe(true);
    });
});
