/** blowfish.test.ts - Independent replay, round-trip, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./blowfish";
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

/** Independent replay of the teaching-core tables and rounds. */
function reference(input: Input): number[] {
    let seed = 0x243f6a88;
    const next = (): number => {
        seed = (Math.imul(seed, 0x41c64e6d) + 0x3039) >>> 0;
        return seed;
    };
    const p = Array.from({ length: 18 }, () => next());
    const s = Array.from({ length: 4 }, () => Array.from({ length: 256 }, () => next()));
    for (let i = 0; i < 18; i += 1) {
        p[i] = ((p[i] ^ ((input.key[i % input.key.length] ?? 0) * 0x01010101)) >>> 0);
    }
    const F = (x: number): number => {
        const a = (x >>> 24) & 255;
        const b = (x >>> 16) & 255;
        const c = (x >>> 8) & 255;
        const d = x & 255;
        const t = (((s[0][a] + s[1][b]) >>> 0) ^ s[2][c]) >>> 0;
        return ((t + s[3][d]) >>> 0) & 0xffffffff;
    };
    let left = 0;
    let right = 0;
    for (let i = 0; i < 4; i += 1) {
        left |= (input.block[i] ?? 0) << (8 * i);
        right |= (input.block[4 + i] ?? 0) << (8 * i);
    }
    left >>>= 0;
    right >>>= 0;
    const order = input.mode === "encrypt"
        ? Array.from({ length: input.rounds }, (_, i) => i)
        : Array.from({ length: input.rounds }, (_, i) => input.rounds + 1 - i);
    for (const round of order) {
        left = (left ^ p[round]) >>> 0;
        right = (right ^ F(left)) >>> 0;
        const t = left;
        left = right;
        right = t;
    }
    const t = left;
    left = right;
    right = t;
    if (input.mode === "encrypt") {
        right = (right ^ p[input.rounds]) >>> 0;
        left = (left ^ p[input.rounds + 1]) >>> 0;
    } else {
        right = (right ^ p[1]) >>> 0;
        left = (left ^ p[0]) >>> 0;
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

describe("Blowfish Teaching Core", () => {
    const base: Input = {
        block: [0, 1, 2, 3, 4, 5, 6, 7],
        key: [1, 2, 3, 4, 5, 6, 7, 8],
        rounds: 16,
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

    it("changes the ciphertext when the key changes", () => {
        expect(outputOf({ ...base, key: [9, 2, 3, 4, 5, 6, 7, 8] })).not.toEqual(outputOf(base));
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
