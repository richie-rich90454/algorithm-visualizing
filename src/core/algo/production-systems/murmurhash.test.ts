/**
 * murmurhash.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./murmurhash";
import type { VisualFrame } from "@/types";

/** Independent MurmurHash3 x86_32 implementation using DataView reads. */
function reference(bytes: number[], seed: number): number {
    const buffer = new Uint8Array(bytes);
    const view = new DataView(buffer.buffer);
    const rotl = (x: number, r: number): number => ((x << r) | (x >>> (32 - r))) >>> 0;
    const mul = (a: number, b: number): number => Math.imul(a, b) >>> 0;
    const c1 = 0xcc9e2d51;
    const c2 = 0x1b873593;
    let h = seed >>> 0;
    const nblocks = bytes.length >> 2;
    for (let i = 0; i < nblocks; i += 1) {
        let k = view.getUint32(i * 4, true);
        k = mul(k, c1);
        k = rotl(k, 15);
        k = mul(k, c2);
        h ^= k;
        h = rotl(h, 13);
        h = (mul(h, 5) + 0xe6546b64) >>> 0;
    }
    let k = 0;
    const start = nblocks * 4;
    const remaining = bytes.length & 3;
    if (remaining === 3) {
        k ^= (bytes[start + 2] ?? 0) << 16;
    }
    if (remaining >= 2) {
        k ^= (bytes[start + 1] ?? 0) << 8;
    }
    if (remaining >= 1) {
        k ^= bytes[start] ?? 0;
        k = mul(k, c1);
        k = rotl(k, 15);
        k = mul(k, c2);
        h ^= k;
    }
    h ^= bytes.length;
    h ^= h >>> 16;
    h = mul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = mul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
}

function ascii(text: string): number[] {
    return Array.from(text, (ch) => ch.charCodeAt(0) & 0xff);
}

function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThanOrEqual(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("MurmurHash3", () => {
    it("matches published reference vectors", () => {
        const vectors: Array<{ text: string; seed: number; hash: number }> = [
            { text: "", seed: 0, hash: 0x00000000 },
            { text: "a", seed: 0, hash: 0x3c2569b2 },
            { text: "abc", seed: 0, hash: 0xb3dd93fa },
            { text: "hello", seed: 0, hash: 0x248bfa47 },
            { text: "The quick brown fox jumps over the lazy dog", seed: 0, hash: 0x2e4ff723 },
            { text: "", seed: 1, hash: 0x514e28b7 },
            { text: "", seed: 42, hash: 0x087fcd5c },
        ];
        for (const vector of vectors) {
            const frames = [...mod.run({ text: vector.text, seed: vector.seed })];
            checkFrames(frames, ascii(vector.text).length);
            const actual = Number(frames[frames.length - 1]?.meta["hash"]);
            expect(actual).toBe(vector.hash);
        }
    });

    it("agrees with the independent implementation on many inputs", () => {
        let state = 1234567;
        const next = (): number => {
            state = (Math.imul(state, 1103515245) + 12345) >>> 0;
            return state;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const length = trial % 25;
            const bytes: number[] = [];
            for (let i = 0; i < length; i += 1) {
                bytes.push(next() & 0xff);
            }
            const seed = next() >>> 0;
            const frames = [...mod.run({ bytes, seed })];
            const actual = Number(frames[frames.length - 1]?.meta["hash"]);
            expect(actual).toBe(reference(bytes, seed));
        }
    });

    it("changes the hash when a single byte changes", () => {
        const base = ascii("a stable message for avalanche checks");
        const finalOf = (bytes: number[]): number =>
            Number([...mod.run({ bytes })].slice(-1)[0]?.meta["hash"]);
        const expected = reference(base, 0);
        expect(finalOf(base)).toBe(expected);
        for (let i = 0; i < base.length; i += 1) {
            const changed = [...base];
            changed[i] = ((changed[i] ?? 0) + 1) & 0xff;
            expect(finalOf(changed)).not.toBe(reference(base, 0));
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
