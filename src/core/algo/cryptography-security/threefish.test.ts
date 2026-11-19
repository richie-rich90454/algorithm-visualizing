/**
 * threefish.test.ts - Independent toy-core implementation, round-trip
 * decryption, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./threefish";
import type { VisualFrame } from "@/types";

const MASK = (1n << 64n) - 1n;
const GOLDEN = 0x9e3779b97f4a7c15n;
const ROT = [16n, 42n, 12n, 62n, 32n, 24n, 51n, 37n];
const add64 = (a: bigint, b: bigint): bigint => (a + b) & MASK;
const sub64 = (a: bigint, b: bigint): bigint => (a - b) & MASK;
const rotl64 = (x: bigint, n: bigint): bigint => ((x << n) | (x >> (64n - n))) & MASK;
const rotr64 = (x: bigint, n: bigint): bigint => ((x >> n) | (x << (64n - n))) & MASK;
const hex = (v: bigint): string => (v & MASK).toString(16).padStart(16, "0");
const subkeys = (key: bigint[], rounds: number): bigint[][] =>
    Array.from({ length: rounds }, (_, r) => key.map((k) => add64(k, GOLDEN * BigInt(r))));

function encrypt(input: bigint[], key: bigint[], rounds: number): bigint[] {
    const v = [...input];
    const sk = subkeys(key, rounds);
    for (let r = 0; r < rounds; r += 1) {
        for (let j = 0; j < 4; j += 1) v[j] = add64(v[j] ?? 0n, sk[r]?.[j] ?? 0n);
        const ra = ROT[(r * 2) % ROT.length] ?? 16n;
        const rb = ROT[(r * 2 + 1) % ROT.length] ?? 42n;
        let x0 = add64(v[0] ?? 0n, v[1] ?? 0n);
        let x1 = rotl64(v[1] ?? 0n, ra) ^ x0;
        v[0] = x0;
        v[1] = x1;
        let x2 = add64(v[2] ?? 0n, v[3] ?? 0n);
        let x3 = rotl64(v[3] ?? 0n, rb) ^ x2;
        v[2] = x2;
        v[3] = x3;
        if (r < rounds - 1) {
            const [a, b, c, d] = v;
            v[0] = c ?? 0n;
            v[1] = d ?? 0n;
            v[2] = a ?? 0n;
            v[3] = b ?? 0n;
        }
    }
    return v;
}

function decrypt(input: bigint[], key: bigint[], rounds: number): bigint[] {
    const v = [...input];
    const sk = subkeys(key, rounds);
    for (let r = rounds - 1; r >= 0; r -= 1) {
        if (r < rounds - 1) {
            const [a, b, c, d] = v;
            v[0] = c ?? 0n;
            v[1] = d ?? 0n;
            v[2] = a ?? 0n;
            v[3] = b ?? 0n;
        }
        const ra = ROT[(r * 2) % ROT.length] ?? 16n;
        const rb = ROT[(r * 2 + 1) % ROT.length] ?? 42n;
        let x0 = v[0] ?? 0n;
        let x1 = v[1] ?? 0n;
        const oldX1 = rotr64(x1 ^ x0, ra);
        const oldX0 = sub64(x0, oldX1);
        v[0] = oldX0;
        v[1] = oldX1;
        let x2 = v[2] ?? 0n;
        let x3 = v[3] ?? 0n;
        const oldX3 = rotr64(x3 ^ x2, rb);
        const oldX2 = sub64(x2, oldX3);
        v[2] = oldX2;
        v[3] = oldX3;
        for (let j = 0; j < 4; j += 1) v[j] = sub64(v[j] ?? 0n, sk[r]?.[j] ?? 0n);
    }
    return v;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Threefish toy core", () => {
    const cases: Array<{ words: string[]; key: string[]; rounds: number }> = [
        { words: ["0x1", "0x2", "0x3", "0x4"], key: ["0x1", "0x2", "0x3", "0x4"], rounds: 8 },
        { words: ["0xdeadbeefcafebabe", "0x1234567890abcdef", "0x0", "0xffffffffffffffff"], key: ["0xa", "0xb", "0xc", "0xd"], rounds: 4 },
        { words: ["0x1122334455667788", "0x99aabbccddeeff00", "0xfedcba9876543210", "0x1"], key: ["0x11", "0x22", "0x33", "0x44"], rounds: 12 },
    ];

    it("matches an independent toy-core implementation", () => {
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames);
            const last = frames[frames.length - 1]?.meta;
            const want = encrypt(c.words.map((w) => BigInt(w)), c.key.map((k) => BigInt(k)), c.rounds);
            expect(last?.["outputWords"]).toEqual(want.map(hex));
            expect(last?.["ciphertext"]).toBe(want.map(hex).join(""));
        }
    });

    it("round-trips encryption and decryption", () => {
        for (const c of cases) {
            const words = c.words.map((w) => BigInt(w));
            const key = c.key.map((k) => BigInt(k));
            const cipher = encrypt(words, key, c.rounds);
            expect(decrypt(cipher, key, c.rounds)).toEqual(words.map((w) => w & MASK));
        }
    });

    it("changes the ciphertext when a key word changes", () => {
        const a = [...mod.run({ words: ["0x1", "0x2", "0x3", "0x4"], key: ["0x1", "0x2", "0x3", "0x4"], rounds: 8 })].slice(-1)[0]?.meta["ciphertext"];
        const b = [...mod.run({ words: ["0x1", "0x2", "0x3", "0x4"], key: ["0x1", "0x2", "0x3", "0x5"], rounds: 8 })].slice(-1)[0]?.meta["ciphertext"];
        expect(a).not.toBe(b);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
