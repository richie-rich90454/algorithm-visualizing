/**
 * blake2b-hash.test.ts - Independent compression replay, determinism and
 * diffusion properties, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./blake2b-hash";
import type { VisualFrame } from "@/types";

const IV = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
];

function checkFrames(frames: VisualFrame[], rounds: number): void {
    expect(frames.length).toBe(rounds + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(16);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(2);
        expect(frame.meta["cols"]).toBe(8);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent 32-bit rotate right. */
function rotate(x: number, n: number): number {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
}

/** Reference message schedule and compression written independently. */
function reference(message: string, rounds: number): number[] {
    const m: number[] = new Array(16).fill(0);
    for (let i = 0; i < message.length; i += 1) {
        const word = Math.floor(i / 4);
        m[word] = (m[word] + (message.charCodeAt(i) & 0xff) * 2 ** (8 * (i % 4))) >>> 0;
    }
    const v = IV.concat(IV);
    const mix = (a: number, b: number, c: number, d: number, x: number, y: number): void => {
        v[a] = (v[a] + v[b] + x) >>> 0;
        v[d] = rotate(v[d] ^ v[a], 16);
        v[c] = (v[c] + v[d]) >>> 0;
        v[b] = rotate(v[b] ^ v[c], 12);
        v[a] = (v[a] + v[b] + y) >>> 0;
        v[d] = rotate(v[d] ^ v[a], 8);
        v[c] = (v[c] + v[d]) >>> 0;
        v[b] = rotate(v[b] ^ v[c], 7);
    };
    for (let r = 0; r < rounds; r += 1) {
        mix(0, 4, 8, 12, m[0], m[1]);
        mix(1, 5, 9, 13, m[2], m[3]);
        mix(2, 6, 10, 14, m[4], m[5]);
        mix(3, 7, 11, 15, m[6], m[7]);
        mix(0, 5, 10, 15, m[8], m[9]);
        mix(1, 6, 11, 12, m[10], m[11]);
        mix(2, 7, 8, 13, m[12], m[13]);
        mix(3, 4, 9, 14, m[14], m[15]);
    }
    return IV.map((value, i) => (value ^ v[i] ^ v[i + 8]) >>> 0);
}

describe("Blake2bHash", () => {
    it("matches an independent compression replay for several messages", () => {
        for (const message of ["", "a", "abc", "hello world", "abcdefghijklmnopqrstuvwxyz"]) {
            const frames = [...mod.run({ message, rounds: 3 })];
            checkFrames(frames, 3);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(message, 3);
            expect(expected).toEqual(final?.["state"]);
            const hex = expected.map((w) => w.toString(16).padStart(8, "0")).join("");
            expect(final?.["digest"]).toBe(hex);
            expect(String(final?.["digest"])).toHaveLength(64);
        }
    });

    it("matches the working vector at every round", () => {
        const frames = [...mod.run({ message: "round check", rounds: 4 })];
        checkFrames(frames, 4);
        const v = IV.concat(IV);
        const m: number[] = new Array(16).fill(0);
        for (let i = 0; i < "round check".length; i += 1) {
            const w = Math.floor(i / 4);
            m[w] = (m[w] + ("round check".charCodeAt(i) & 0xff) * 2 ** (8 * (i % 4))) >>> 0;
        }
        const mix = (a: number, b: number, c: number, d: number, x: number, y: number): void => {
            v[a] = (v[a] + v[b] + x) >>> 0;
            v[d] = rotate(v[d] ^ v[a], 16);
            v[c] = (v[c] + v[d]) >>> 0;
            v[b] = rotate(v[b] ^ v[c], 12);
            v[a] = (v[a] + v[b] + y) >>> 0;
            v[d] = rotate(v[d] ^ v[a], 8);
            v[c] = (v[c] + v[d]) >>> 0;
            v[b] = rotate(v[b] ^ v[c], 7);
        };
        for (let r = 1; r <= 4; r += 1) {
            mix(0, 4, 8, 12, m[0], m[1]);
            mix(1, 5, 9, 13, m[2], m[3]);
            mix(2, 6, 10, 14, m[4], m[5]);
            mix(3, 7, 11, 15, m[6], m[7]);
            mix(0, 5, 10, 15, m[8], m[9]);
            mix(1, 6, 11, 12, m[10], m[11]);
            mix(2, 7, 8, 13, m[12], m[13]);
            mix(3, 4, 9, 14, m[14], m[15]);
            expect(frames[r]?.meta["v"]).toEqual([...v]);
        }
    });

    it("is deterministic and changes the digest when a byte changes", () => {
        const a = [...mod.run({ message: "cat", rounds: 2 })].pop()?.meta["digest"];
        const aAgain = [...mod.run({ message: "cat", rounds: 2 })].pop()?.meta["digest"];
        const b = [...mod.run({ message: "cats", rounds: 2 })].pop()?.meta["digest"];
        expect(a).toBe(aAgain);
        expect(a).not.toBe(b);
        const words = [...mod.run({ message: "abc", rounds: 2 })].pop()?.meta["v"] as number[];
        words.forEach((word) => {
            expect(word).toBeGreaterThanOrEqual(0);
            expect(word).toBeLessThanOrEqual(0xffffffff);
        });
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
