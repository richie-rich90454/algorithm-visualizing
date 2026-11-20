/**
 * padding-oracle-attack.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./padding-oracle-attack";
import type { VisualFrame } from "@/types";

interface Input {
    plaintext: string;
    key: number[];
    iv: number[];
}

/** Independent toy S-box using explicit modulo (not bitwise masking). */
function forward(x: number): number {
    return (7 * x + 13) % 256;
}
function inverse(y: number): number {
    return ((183 * ((y - 13) % 256)) % 256 + 256) % 256;
}
function enc(block: number[], key: number[]): number[] {
    return block.map((value, i) => forward((value ^ key[i]!) % 256));
}
function dec(block: number[], key: number[]): number[] {
    return block.map((value, i) => inverse(value) ^ key[i]!);
}
function padded(bytes: number[]): boolean {
    const n = bytes[bytes.length - 1]!;
    return n >= 1 && n <= 4 && bytes.slice(4 - n).every((value) => value === n);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Padding Oracle Attack", () => {
    const input = mod.defaultInput as Input;

    it("uses an invertible toy cipher and a correct padding oracle", () => {
        const key = input.key;
        const block = [0x41, 0x42, 0x43, 0x44];
        expect(dec(enc(block, key), key)).toEqual(block);
        expect(padded([1, 1, 1, 1])).toBe(true);
        expect(padded([3, 3, 3, 3])).toBe(true);
        expect(padded([9, 9, 9, 2])).toBe(false);
        expect(padded([9, 9, 9, 5])).toBe(false);
    });

    it("recovers the plaintext block byte by byte on the default input", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = [...input.plaintext.slice(0, 4).padEnd(4, "A")].map((ch) => ch.charCodeAt(0) & 0xff);
        expect(final?.["recovered"]).toEqual(expected);
        expect(final?.["match"]).toBe(1);
    });

    it("recovers the block for many random keys, IVs and messages", () => {
        let seed = 6060;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 25; trial += 1) {
            const key = Array.from({ length: 4 }, () => rand() & 0xff);
            const iv = Array.from({ length: 4 }, () => rand() & 0xff);
            const text = Array.from({ length: 4 }, () => String.fromCharCode(65 + (rand() % 26))).join("");
            const testInput: Input = { plaintext: text, key, iv };
            const frames = [...mod.run(testInput)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["recovered"]).toEqual([...text].map((ch) => ch.charCodeAt(0)));
            expect(final?.["match"]).toBe(1);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
