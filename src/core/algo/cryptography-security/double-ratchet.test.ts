/**
 * double-ratchet.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./double-ratchet";
import type { VisualFrame } from "@/types";

function kdf(...parts: number[]): number {
    let h = 2166136261 >>> 0;
    for (const part of parts) {
        let value = part >>> 0;
        for (let byte = 0; byte < 4; byte += 1) {
            h = Math.imul(h ^ (value & 0xff), 16777619) >>> 0;
            value = value >>> 8;
        }
    }
    h ^= h >>> 16;
    h = Math.imul(h, 2246822507) >>> 0;
    h ^= h >>> 13;
    return h >>> 0;
}

function reference(seed: number, dhOutputs: number[], perEpoch: number) {
    let root = seed >>> 0;
    const keys: number[] = [];
    const plains: number[] = [];
    const ciphers: number[] = [];
    let epoch = 0;
    for (const dh of dhOutputs) {
        let chain = kdf(root, dh >>> 0, 0x45);
        root = kdf(root, dh >>> 0, 0x52);
        for (let m = 0; m < perEpoch; m += 1) {
            const key = kdf(chain, 0x4d);
            chain = kdf(chain, 0x43);
            const plain = (epoch * 17 + m * 31 + 7) % 256;
            keys.push(key);
            plains.push(plain);
            ciphers.push(plain ^ (key & 0xff));
        }
        epoch += 1;
    }
    return { keys, plains, ciphers };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Double Ratchet (Toy KDF Chains)", () => {
    it("matches an independent KDF-chain derivation", () => {
        const input = mod.defaultInput as { seed: number; dhOutputs: number[]; messagesPerEpoch: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta ?? {};
        const expected = reference(input.seed, input.dhOutputs, input.messagesPerEpoch);
        expect(final["keys"]).toEqual(expected.keys);
        expect(final["plains"]).toEqual(expected.plains);
        expect(final["ciphers"]).toEqual(expected.ciphers);
    });

    it("derives distinct keys and decrypts every message", () => {
        const inputs = [
            { seed: 1, dhOutputs: [5], messagesPerEpoch: 3 },
            { seed: 99, dhOutputs: [7, 8, 9, 10], messagesPerEpoch: 2 },
            { seed: 4294967295, dhOutputs: [12345, 67890], messagesPerEpoch: 1 },
        ];
        for (const input of inputs) {
            const frames = [...mod.run(input)];
            const final = frames[frames.length - 1]?.meta ?? {};
            const keys = final["keys"] as number[];
            const ciphers = final["ciphers"] as number[];
            const plains = final["plains"] as number[];
            expect(new Set(keys).size).toBe(keys.length);
            ciphers.forEach((cipher, index) => {
                expect(cipher ^ (keys[index] & 0xff)).toBe(plains[index]);
            });
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
