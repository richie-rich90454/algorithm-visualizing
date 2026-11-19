/**
 * tea.test.ts - Independent TEA implementation, round-trip decryption,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./tea";
import type { VisualFrame } from "@/types";

const DELTA = 0x9e3779b9;
const wrap = (x: number): number => x >>> 0;

function encrypt(v0: number, v1: number, key: number[], rounds: number): [number, number] {
    let a = wrap(v0);
    let b = wrap(v1);
    let sum = 0;
    for (let i = 0; i < rounds; i += 1) {
        sum = wrap(sum + DELTA);
        a = wrap(a + (wrap((b << 4) + (key[0] ?? 0)) ^ wrap(b + sum) ^ wrap((b >>> 5) + (key[1] ?? 0))));
        b = wrap(b + (wrap((a << 4) + (key[2] ?? 0)) ^ wrap(a + sum) ^ wrap((a >>> 5) + (key[3] ?? 0))));
    }
    return [a, b];
}

function decrypt(v0: number, v1: number, key: number[], rounds: number): [number, number] {
    let a = wrap(v0);
    let b = wrap(v1);
    let sum = wrap(DELTA * rounds);
    for (let i = 0; i < rounds; i += 1) {
        b = wrap(b - (wrap((a << 4) + (key[2] ?? 0)) ^ wrap(a + sum) ^ wrap((a >>> 5) + (key[3] ?? 0))));
        a = wrap(a - (wrap((b << 4) + (key[0] ?? 0)) ^ wrap(b + sum) ^ wrap((b >>> 5) + (key[1] ?? 0))));
        sum = wrap(sum - DELTA);
    }
    return [a, b];
}

/** XTEA round function, used only to confirm TEA is a distinct cipher. */
function xteaEncrypt(v0: number, v1: number, key: number[], rounds: number): [number, number] {
    let a = wrap(v0);
    let b = wrap(v1);
    let sum = 0;
    const mix = (word: number, k: number): number =>
        wrap((((word << 4) ^ (word >>> 5)) + word) ^ (sum + k));
    for (let i = 0; i < rounds; i += 1) {
        a = wrap(a + mix(b, key[sum & 3] ?? 0));
        sum = wrap(sum + DELTA);
        b = wrap(b + mix(a, key[(sum >>> 11) & 3] ?? 0));
    }
    return [a, b];
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

describe("TEA", () => {
    const cases: Array<{ words: [number, number]; key: number[]; rounds: number }> = [
        { words: [0x12345678, 0x9abcdef0], key: [0x01234567, 0x89abcdef, 0xfedcba98, 0x76543210], rounds: 32 },
        { words: [0, 0], key: [1, 2, 3, 4], rounds: 16 },
        { words: [0xdeadbeef, 0xcafebabe], key: [0xffffffff, 0, 1, 2], rounds: 8 },
    ];

    it("matches an independent TEA implementation", () => {
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames);
            const last = frames[frames.length - 1]?.meta;
            const want = encrypt(c.words[0], c.words[1], c.key, c.rounds);
            expect(last?.["v0"]).toBe(want[0]);
            expect(last?.["v1"]).toBe(want[1]);
            expect(last?.["sum"]).toBe(wrap(DELTA * c.rounds));
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

    it("differs from XTEA on the same block and key", () => {
        const input = { words: [0x12345678, 0x9abcdef0] as [number, number], key: [1, 2, 3, 4], rounds: 16 };
        const teaCipher = [...mod.run(input)].slice(-1)[0]?.meta["ciphertext"];
        const [xa, xb] = xteaEncrypt(input.words[0], input.words[1], input.key, input.rounds);
        const xteaCipher = xa.toString(16).padStart(8, "0") + xb.toString(16).padStart(8, "0");
        expect(teaCipher).not.toBe(xteaCipher);
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
