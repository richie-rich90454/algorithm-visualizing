/**
 * umac.test.ts - Independent NH/tag replay, properties, frame shape checks,
 * and termination for the UMAC teaching core.
 */

import { describe, expect, it } from "vitest";
import mod, { computeUmac, nhHash, reduce, toWords } from "./umac";
import type { VisualFrame } from "@/types";

const MASK32 = 0xffffffffn;
const MASK64 = 0xffffffffffffffffn;
const P = 4294967291n;

function referenceNh(message: number[], key: number[]): bigint {
    let sum = 0n;
    for (let i = 0; i + 1 < Math.min(message.length, key.length); i += 2) {
        const left = BigInt(message[i]!) + BigInt(key[i]!);
        const right = BigInt(message[i + 1]!) + BigInt(key[i + 1]!);
        sum = (sum + (left & MASK32) * (right & MASK32)) & MASK64;
    }
    return sum;
}

function referenceTag(message: number[], nhKey: number[], poly: number, nonce: number): bigint {
    const words = toWords(message);
    const secret = reduce(BigInt(poly));
    let tag = secret;
    for (let i = 0; i < words.length; i += 2) {
        const chunk = reduce(nhHash([words[i] ?? 0, words[i + 1] ?? 0], [nhKey[i % nhKey.length] ?? 0, nhKey[(i + 1) % nhKey.length] ?? 0]));
        tag = reduce(tag * secret + chunk);
    }
    return reduce(tag + reduce(BigInt(nonce >>> 0)));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(24);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(3);
        expect(frame.meta["cols"]).toBe(8);
        expect(typeof frame.meta["tag"]).toBe("string");
    });
}

describe("UMAC / NH teaching core", () => {
    it("matches an independent NH summation and reduce", () => {
        for (let trial = 0; trial < 60; trial += 1) {
            const message = Array.from({ length: 2 * (trial % 7 + 1) }, (_, i) => (trial * 131 + i * 977) & 0xffffffff);
            const key = Array.from({ length: 4 }, (_, i) => (trial * 65537 + i * 7919) & 0xffffffff);
            expect(nhHash(message, key)).toBe(referenceNh(message, key));
        }
        expect(reduce(0n)).toBe(0n);
        expect(reduce(P)).toBe(0n);
        expect(reduce(P + 3n)).toBe(3n);
        expect(toWords([1, 2, 3])).toEqual([0x01020300]);
        expect(toWords([1, 2, 3, 4, 5])).toEqual([0x01020304, 0x05000000]);
    });

    it("matches an independent tag replay and reacts to every secret input", () => {
        const input = mod.defaultInput as { message: number[]; nhKey: number[]; polynomialKey: number; nonce: number };
        const expected = referenceTag(input.message, input.nhKey, input.polynomialKey, input.nonce);
        expect(computeUmac(input.message, { nh: input.nhKey, polynomial: input.polynomialKey }, input.nonce).tag).toBe(expected);
        expect(computeUmac([...input.message, 1], { nh: input.nhKey, polynomial: input.polynomialKey }, input.nonce).tag).not.toBe(expected);
        expect(computeUmac(input.message, { nh: [input.nhKey[0]! ^ 1, ...input.nhKey.slice(1)], polynomial: input.polynomialKey }, input.nonce).tag).not.toBe(expected);
        expect(computeUmac(input.message, { nh: input.nhKey, polynomial: input.polynomialKey + 1 }, input.nonce).tag).not.toBe(expected);
        expect(computeUmac(input.message, { nh: input.nhKey, polynomial: input.polynomialKey }, input.nonce + 1).tag).not.toBe(expected);
        expect(computeUmac(input.message, { nh: input.nhKey, polynomial: input.polynomialKey }, input.nonce).tag).toBe(expected);
    });

    it("bounds collisions over a brute-force sweep of short messages", () => {
        const keys = { nh: [11, 22, 33, 44], polynomial: 101 };
        const seen = new Map<string, string>();
        let collisions = 0;
        for (let a = 0; a < 40; a += 1) {
            for (let b = 0; b < 40; b += 1) {
                const tag = computeUmac([a, b], keys, 3).tag.toString();
                const message = `${a},${b}`;
                if (seen.has(tag) && seen.get(tag) !== message) {
                    collisions += 1;
                }
                seen.set(tag, message);
            }
        }
        expect(collisions).toBeLessThan(10);
    });

    it("emits well-formed frames consistent with a fresh run", () => {
        const input = mod.defaultInput as { message: number[]; nhKey: number[]; polynomialKey: number; nonce: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = computeUmac(input.message, { nh: input.nhKey, polynomial: input.polynomialKey }, input.nonce).tag;
        expect(frames[frames.length - 1]!.meta["tag"]).toBe(expected.toString(16).toUpperCase().padStart(8, "0"));
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
