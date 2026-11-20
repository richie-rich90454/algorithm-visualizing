/**
 * rc5.test.ts - Independent RC5 implementation, round-trip decryption,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./rc5";
import type { VisualFrame } from "@/types";

const P32 = 0xb7e15163;
const Q32 = 0x9e3779b9;
const wrap = (x: number): number => x >>> 0;
const rotl = (x: number, n: number): number => {
    const s = n & 31;
    return s === 0 ? wrap(x) : wrap((x << s) | (x >>> (32 - s)));
};
const rotr = (x: number, n: number): number => {
    const s = n & 31;
    return s === 0 ? wrap(x) : wrap((x >>> s) | (x << (32 - s)));
};

function expand(key: number[], rounds: number): number[] {
    const t = 2 * (rounds + 1);
    const s: number[] = new Array(t);
    s[0] = P32;
    for (let i = 1; i < t; i += 1) s[i] = wrap((s[i - 1] ?? 0) + Q32);
    const c = Math.max(1, Math.ceil(key.length / 4));
    const l: number[] = new Array(c).fill(0);
    for (let i = 0; i < key.length; i += 1) {
        l[Math.floor(i / 4)] = wrap((l[Math.floor(i / 4)] ?? 0) + ((key[i] ?? 0) << (8 * (i % 4))));
    }
    let i = 0;
    let j = 0;
    let a = 0;
    let b = 0;
    for (let k = 0; k < 3 * Math.max(t, c); k += 1) {
        a = s[i] = rotl(wrap((s[i] ?? 0) + a + b), 3);
        b = l[j] = rotl(wrap((l[j] ?? 0) + a + b), a + b);
        i = (i + 1) % t;
        j = (j + 1) % c;
    }
    return s;
}

function encrypt(a0: number, b0: number, key: number[], rounds: number): [number, number] {
    const s = expand(key, rounds);
    let a = wrap(wrap(a0) + (s[0] ?? 0));
    let b = wrap(wrap(b0) + (s[1] ?? 0));
    for (let r = 1; r <= rounds; r += 1) {
        a = wrap(rotl(wrap(a ^ b), b) + (s[2 * r] ?? 0));
        b = wrap(rotl(wrap(b ^ a), a) + (s[2 * r + 1] ?? 0));
    }
    return [a, b];
}

function decrypt(a0: number, b0: number, key: number[], rounds: number): [number, number] {
    const s = expand(key, rounds);
    let a = wrap(a0);
    let b = wrap(b0);
    for (let r = rounds; r >= 1; r -= 1) {
        b = rotr(wrap(b - (s[2 * r + 1] ?? 0)), a) ^ a;
        b = wrap(b);
        a = rotr(wrap(a - (s[2 * r] ?? 0)), b) ^ b;
        a = wrap(a);
    }
    return [wrap(wrap(a - (s[0] ?? 0))), wrap(wrap(b - (s[1] ?? 0)))];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("RC5", () => {
    const cases: Array<{ words: [number, number]; key: number[]; rounds: number }> = [
        { words: [0x12345678, 0x9abcdef0], key: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], rounds: 12 },
        { words: [0, 0], key: [1, 2, 3, 4], rounds: 8 },
        { words: [0xdeadbeef, 0xcafebabe], key: [255, 128, 64, 32, 16], rounds: 6 },
        { words: [0xffffffff, 1], key: [9], rounds: 4 },
    ];

    it("matches an independent RC5 implementation", () => {
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames);
            const last = frames[frames.length - 1]?.meta;
            const want = encrypt(c.words[0], c.words[1], c.key, c.rounds);
            expect(last?.["v0"]).toBe(want[0]);
            expect(last?.["v1"]).toBe(want[1]);
            expect(last?.["ciphertext"]).toBe(
                want[0].toString(16).padStart(8, "0") + want[1].toString(16).padStart(8, "0"),
            );
        }
    });

    it("round-trips encryption and decryption", () => {
        for (const c of cases) {
            const [c0, c1] = encrypt(c.words[0], c.words[1], c.key, c.rounds);
            expect(decrypt(c0, c1, c.key, c.rounds)).toEqual([
                wrap(c.words[0]),
                wrap(c.words[1]),
            ]);
        }
    });

    it("changes the ciphertext when the key changes", () => {
        const first = [...mod.run({ words: [1, 2], key: [1, 2, 3, 4], rounds: 8 })].slice(-1)[0]?.meta["ciphertext"];
        const second = [...mod.run({ words: [1, 2], key: [1, 2, 3, 5], rounds: 8 })].slice(-1)[0]?.meta["ciphertext"];
        expect(first).not.toBe(second);
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
