/** cham-cipher.test.ts - Independent even-odd replay, round trip, key sensitivity, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./cham-cipher";
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
    let seed = 0x0badf00d;
    for (const byte of input.key) {
        seed = (Math.imul(seed ^ byte, 0x85ebca6b) + 0xc2b2ae35) >>> 0;
    }
    const next = (): number => {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        return seed & MASK;
    };
    const rk = Array.from({ length: input.rounds * 16 }, () => next());
    const stepA = (w: number[], k: number[]): number[] => {
        const out = w.slice();
        for (let i = 0; i < 4; i += 1) {
            out[2 * i + 1] = (rotl(w[2 * i + 1] ^ k[i], 1) + (w[2 * i] ^ k[4 + i])) & MASK;
        }
        return out;
    };
    const stepB = (w: number[], k: number[]): number[] => {
        const out = w.slice();
        for (let i = 0; i < 4; i += 1) {
            out[2 * i] = (rotl(w[2 * i] ^ k[8 + i], 1) + (w[2 * i + 1] ^ k[12 + i])) & MASK;
        }
        return out;
    };
    const stepAInv = (w: number[], k: number[]): number[] => {
        const out = w.slice();
        for (let i = 0; i < 4; i += 1) {
            const rotated = (w[2 * i + 1] - (w[2 * i] ^ k[4 + i])) & MASK;
            out[2 * i + 1] = rotr(rotated, 1) ^ k[i];
        }
        return out;
    };
    const stepBInv = (w: number[], k: number[]): number[] => {
        const out = w.slice();
        for (let i = 0; i < 4; i += 1) {
            const rotated = (w[2 * i] - (w[2 * i + 1] ^ k[12 + i])) & MASK;
            out[2 * i] = rotr(rotated, 1) ^ k[8 + i];
        }
        return out;
    };
    let state = Array.from({ length: 8 }, (_, index) =>
        ((input.block[2 * index] ?? 0) | ((input.block[2 * index + 1] ?? 0) << 8)) & MASK,
    );
    if (input.mode === "encrypt") {
        for (let round = 0; round < input.rounds; round += 1) {
            const k = rk.slice(round * 16, round * 16 + 16);
            state = stepB(stepA(state, k), k);
        }
    } else {
        for (let round = input.rounds - 1; round >= 0; round -= 1) {
            const k = rk.slice(round * 16, round * 16 + 16);
            state = stepAInv(stepBInv(state, k), k);
        }
    }
    const out: number[] = [];
    for (let index = 0; index < 8; index += 1) {
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
        expect(frame.entities.length).toBe(16);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("ChamCipher", () => {
    const base: Input = {
        block: Array.from({ length: 16 }, (_, index) => index),
        key: [0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef],
        rounds: 8,
        mode: "encrypt",
    };

    it("matches an independent even-odd replay", () => {
        const inputs: Input[] = [
            base,
            { ...base, block: Array.from({ length: 16 }, (_, index) => (index * 7) & 0xff), rounds: 4 },
            { ...base, key: [1, 2, 3], rounds: 6 },
        ];
        for (const input of inputs) {
            checkFrames([...mod.run(input)]);
            expect(outputOf(input)).toEqual(reference(input));
        }
    });

    it("recovers the plaintext on decryption for many blocks", () => {
        for (let variant = 0; variant < 8; variant += 1) {
            const block = Array.from({ length: 16 }, (_, index) => (variant * 13 + index * 11) & 0xff);
            const ciphertext = outputOf({ ...base, block });
            expect(outputOf({ ...base, block: ciphertext, mode: "decrypt" })).toEqual(block);
        }
    });

    it("changes the ciphertext when the key changes", () => {
        expect(outputOf({ ...base, key: [0xff, 0x23, 0x45, 0x67] })).not.toEqual(outputOf(base));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(base);
        expect([...generator].length).toBe(base.rounds + 2);
        expect(generator.next().done).toBe(true);
    });
});
