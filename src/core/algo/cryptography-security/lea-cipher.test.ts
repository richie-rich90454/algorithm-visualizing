/** lea-cipher.test.ts - Independent ARX replay, round trip, key sensitivity, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./lea-cipher";
import type { VisualFrame } from "@/types";

interface Input {
    block: number[];
    key: number[];
    rounds: number;
    mode: "encrypt" | "decrypt";
}

const MASK = 0xffff;
const rotl = (x: number, n: number): number => ((x << n) | (x >>> (16 - n))) & MASK;
const rotr = (x: number, n: number): number => ((x >>> n) | (x << (16 - n))) & MASK;

function reference(input: Input): number[] {
    let seed = 0x1a2b3c4d;
    for (const byte of input.key) {
        seed = (Math.imul(seed ^ byte, 0x5bd1e995) + 0x9e3779b9) >>> 0;
    }
    const next = (): number => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed & MASK;
    };
    const rk = Array.from({ length: input.rounds * 8 }, () => next());
    const step = (w: number[], k: number[]): number[] => {
        const a = rotl((w[0] + k[0]) & MASK, 1);
        const b = rotl((w[1] ^ k[1]) & MASK, 3);
        const c = rotl((w[2] + k[2]) & MASK, 6);
        const d = rotl((w[3] ^ k[3]) & MASK, 11);
        const na = (a + b) & MASK;
        return [na, (b + c) & MASK, (c + d) & MASK, (d + na) & MASK];
    };
    const stepInv = (w: number[], k: number[]): number[] => {
        const d = (w[3] - w[0]) & MASK;
        const c = (w[2] - d) & MASK;
        const b = (w[1] - c) & MASK;
        const a = (w[0] - b) & MASK;
        return [(rotr(a, 1) - k[0]) & MASK, rotr(b, 3) ^ k[1], (rotr(c, 6) - k[2]) & MASK, rotr(d, 11) ^ k[3]];
    };
    const words = [0, 1, 2, 3].map((index) => ((input.block[2 * index] ?? 0) | ((input.block[2 * index + 1] ?? 0) << 8)) & MASK);
    let state = words;
    if (input.mode === "encrypt") {
        for (let round = 0; round < input.rounds; round += 1) {
            state = step(state, rk.slice(round * 8, round * 8 + 4));
            state = step(state, rk.slice(round * 8 + 4, round * 8 + 8));
        }
    } else {
        for (let round = input.rounds - 1; round >= 0; round -= 1) {
            state = stepInv(state, rk.slice(round * 8 + 4, round * 8 + 8));
            state = stepInv(state, rk.slice(round * 8, round * 8 + 4));
        }
    }
    const out: number[] = [];
    for (let index = 0; index < 4; index += 1) {
        out.push(state[index] & 0xff);
        out.push((state[index] >>> 8) & 0xff);
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

describe("LeaCipher", () => {
    const base: Input = {
        block: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef],
        key: [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88],
        rounds: 6,
        mode: "encrypt",
    };

    it("matches an independent ARX replay", () => {
        const inputs: Input[] = [
            base,
            { ...base, block: [0, 1, 2, 3, 4, 5, 6, 7], rounds: 3 },
            { ...base, key: [9, 8, 7, 6], rounds: 5 },
        ];
        for (const input of inputs) {
            checkFrames([...mod.run(input)]);
            expect(outputOf(input)).toEqual(reference(input));
        }
    });

    it("recovers the plaintext on decryption for many blocks", () => {
        for (let variant = 0; variant < 8; variant += 1) {
            const block = Array.from({ length: 8 }, (_, index) => (variant * 31 + index * 17) & 0xff);
            const ciphertext = outputOf({ ...base, block });
            expect(outputOf({ ...base, block: ciphertext, mode: "decrypt" })).toEqual(block);
        }
    });

    it("changes the ciphertext when the key changes", () => {
        expect(outputOf({ ...base, key: [0x11, 0xff, 0x33, 0x44] })).not.toEqual(outputOf(base));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(base);
        expect([...generator].length).toBe(base.rounds + 2);
        expect(generator.next().done).toBe(true);
    });
});
