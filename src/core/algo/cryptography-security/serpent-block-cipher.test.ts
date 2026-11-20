/** serpent-block-cipher.test.ts - Independent SPN replay, bijection, round-trip, termination. */

import { describe, expect, it } from "vitest";
import mod from "./serpent-block-cipher";
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
    const perm = [7, 0, 5, 2, 3, 4, 1, 6];
    const S = (v: number): number => ((((v & 255) << 1) | ((v & 255) >>> 7)) ^ 0x5a) & 255;
    const Si = (v: number): number => {
        const z = (v ^ 0x5a) & 255;
        return ((z >>> 1) | ((z << 7) & 255)) & 255;
    };
    const keys = Array.from({ length: input.rounds + 1 }, (_, i) =>
        Array.from({ length: 8 }, (_, j) => ((input.key[(i * 8 + j) % input.key.length] ?? 0) ^ i * 0x11) & 255),
    );
    const bytes = input.block.slice();
    if (input.mode === "encrypt") {
        for (let i = 0; i < input.rounds; i += 1) {
            for (let j = 0; j < 8; j += 1) bytes[j] = (bytes[j] ^ keys[i][j]) & 255;
            const sub = bytes.map(S);
            for (let j = 0; j < 8; j += 1) bytes[j] = sub[perm[j]];
        }
        for (let j = 0; j < 8; j += 1) bytes[j] = (bytes[j] ^ keys[input.rounds][j]) & 255;
    } else {
        for (let j = 0; j < 8; j += 1) bytes[j] = (bytes[j] ^ keys[input.rounds][j]) & 255;
        for (let i = input.rounds - 1; i >= 0; i -= 1) {
            const inv = new Array<number>(8).fill(0);
            for (let j = 0; j < 8; j += 1) inv[perm[j]] = bytes[j];
            for (let j = 0; j < 8; j += 1) bytes[j] = Si(inv[j]) ^ keys[i][j];
        }
    }
    return bytes;
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

describe("Serpent Teaching Core", () => {
    const base: Input = {
        block: [0, 1, 2, 3, 4, 5, 6, 7],
        key: [3, 1, 4, 1, 5, 9, 2, 6],
        rounds: 8,
        mode: "encrypt",
    };

    it("matches an independent SPN replay", () => {
        checkFrames([...mod.run(base)]);
        expect(outputOf(base)).toEqual(reference(base));
    });

    it("recovers the plaintext on decryption", () => {
        const ciphertext = outputOf(base);
        expect(outputOf({ ...base, block: ciphertext, mode: "decrypt" })).toEqual(base.block);
    });

    it("uses a bijective byte S-box", () => {
        const s = (v: number): number => ((((v << 1) | (v >>> 7)) ^ 0x5a) & 255);
        const seen = new Set(Array.from({ length: 256 }, (_, i) => s(i)));
        expect(seen.size).toBe(256);
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
