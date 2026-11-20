/** camellia.test.ts - Independent replay, round-trip, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./camellia";
import type { VisualFrame } from "@/types";

interface Input {
    block: number[];
    key: number[];
    rounds: number;
    mode: "encrypt" | "decrypt";
}

function outputOf(input: Input): number[] {
    const frames = [...mod.run(input)];
    return frames[frames.length - 1]?.meta["output"] as number[];
}

function reference(input: Input): number[] {
    const rotl = (v: number, n: number): number => ((v << n) | (v >>> (32 - n))) >>> 0;
    const rotr = (v: number, n: number): number => ((v >>> n) | (v << (32 - n))) >>> 0;
    const S = (v: number): number => ((((v & 255) << 1) | ((v & 255) >>> 7)) ^ 0x5a) & 255;
    const F = (x: number, k: number): number => {
        const t = rotl((x ^ k) >>> 0, 7);
        const sub = ((S((t >>> 24) & 255) << 24) | (S((t >>> 16) & 255) << 16) |
            (S((t >>> 8) & 255) << 8) | S(t & 255)) >>> 0;
        return (t ^ sub) >>> 0;
    };
    const FL = (x: number, k: number): number => rotl((x ^ k) >>> 0, 3);
    const FLi = (x: number, k: number): number => (rotr(x, 3) ^ k) >>> 0;
    const word = (i: number): number => {
        const k = input.key;
        return (((k[i % k.length] ?? 0) << 24) | ((k[(i + 1) % k.length] ?? 0) << 16) |
            ((k[(i + 2) % k.length] ?? 0) << 8) | (k[(i + 3) % k.length] ?? 0)) >>> 0;
    };
    const w = [word(0), word(4), word(8), word(12)];
    const rk = Array.from({ length: input.rounds }, (_, i) => word(i + 1));
    const fk = [word(input.rounds + 1), word(input.rounds + 5)];
    const middle = Math.floor(input.rounds / 2) - 1;
    let left = 0;
    let right = 0;
    for (let i = 0; i < 4; i += 1) {
        left |= (input.block[i] ?? 0) << (8 * i);
        right |= (input.block[4 + i] ?? 0) << (8 * i);
    }
    left >>>= 0;
    right >>>= 0;
    if (input.mode === "encrypt") {
        left = (left ^ w[0]) >>> 0;
        right = (right ^ w[1]) >>> 0;
        for (let i = 0; i < input.rounds; i += 1) {
            left = (left ^ F(right, rk[i])) >>> 0;
            const t = left; left = right; right = t;
            if (i === middle) {
                left = FL(left, fk[0]);
                right = FL(right, fk[1]);
            }
        }
        const t = left; left = right; right = t;
        left = (left ^ w[2]) >>> 0;
        right = (right ^ w[3]) >>> 0;
    } else {
        left = (left ^ w[2]) >>> 0;
        right = (right ^ w[3]) >>> 0;
        const t = left; left = right; right = t;
        for (let i = input.rounds - 1; i >= 0; i -= 1) {
            if (i === middle) {
                left = FLi(left, fk[0]);
                right = FLi(right, fk[1]);
            }
            const pr = left;
            const pl = (right ^ F(left, rk[i])) >>> 0;
            left = pl; right = pr;
        }
        left = (left ^ w[0]) >>> 0;
        right = (right ^ w[1]) >>> 0;
    }
    const out: number[] = [];
    for (let i = 0; i < 4; i += 1) out.push((left >>> (8 * i)) & 255);
    for (let i = 0; i < 4; i += 1) out.push((right >>> (8 * i)) & 255);
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(8);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Camellia Teaching Core", () => {
    const base: Input = {
        block: [0, 1, 2, 3, 4, 5, 6, 7],
        key: [1, 2, 3, 4, 5, 6, 7, 8],
        rounds: 6,
        mode: "encrypt",
    };

    it("matches an independent Feistel replay", () => {
        checkFrames([...mod.run(base)]);
        expect(outputOf(base)).toEqual(reference(base));
    });

    it("recovers the plaintext on decryption", () => {
        const ciphertext = outputOf(base);
        expect(outputOf({ ...base, block: ciphertext, mode: "decrypt" })).toEqual(base.block);
    });

    it("changes ciphertext under a different key", () => {
        expect(outputOf({ ...base, key: [2, 2, 3, 4, 5, 6, 7, 8] })).not.toEqual(outputOf(base));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(base);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(base.rounds + 2);
        expect(generator.next().done).toBe(true);
    });
});
