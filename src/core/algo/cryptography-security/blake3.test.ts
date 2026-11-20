/** blake3.test.ts - Independent compression replay, avalanche, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./blake3";
import type { VisualFrame } from "@/types";

function hashOf(message: string): string {
    const frames = [...mod.run({ message })];
    return String(frames[frames.length - 1]?.meta["hash"]);
}

/** Independent implementation of the single-block teaching-core compression. */
function reference(message: string): string {
    const IV = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ];
    const perm = [2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8];
    const rotr = (x: number, n: number): number => ((x >>> n) | (x << (32 - n))) >>> 0;
    const bytes: number[] = [];
    for (let i = 0; i < message.length && i < 64; i += 1) bytes.push(message.charCodeAt(i) & 255);
    const m = Array.from({ length: 16 }, (_, w) => {
        let value = 0;
        for (let j = 0; j < 4; j += 1) value += (bytes[w * 4 + j] ?? 0) * 2 ** (8 * j);
        return value >>> 0;
    });
    const v = [...IV, IV[0], IV[1], IV[2], IV[3], 0, 0, bytes.length, 0];
    const G = (a: number, b: number, c: number, d: number, mx: number, my: number): void => {
        v[a] = (v[a] + v[b] + mx) >>> 0;
        v[d] = rotr(v[d] ^ v[a], 16);
        v[c] = (v[c] + v[d]) >>> 0;
        v[b] = rotr(v[b] ^ v[c], 12);
        v[a] = (v[a] + v[b] + my) >>> 0;
        v[d] = rotr(v[d] ^ v[a], 8);
        v[c] = (v[c] + v[d]) >>> 0;
        v[b] = rotr(v[b] ^ v[c], 7);
    };
    let cur = m;
    for (let r = 0; r < 7; r += 1) {
        G(0, 4, 8, 12, cur[0], cur[1]);
        G(1, 5, 9, 13, cur[2], cur[3]);
        G(2, 6, 10, 14, cur[4], cur[5]);
        G(3, 7, 11, 15, cur[6], cur[7]);
        G(0, 5, 10, 15, cur[8], cur[9]);
        G(1, 6, 11, 12, cur[10], cur[11]);
        G(2, 7, 8, 13, cur[12], cur[13]);
        G(3, 4, 9, 14, cur[14], cur[15]);
        if (r < 6) cur = perm.map((i) => cur[i]);
    }
    const out: number[] = [];
    for (let i = 0; i < 8; i += 1) {
        const w = (v[i] ^ v[i + 8]) >>> 0;
        for (let j = 0; j < 4; j += 1) out.push((w >>> (8 * j)) & 255);
    }
    return out.map((x) => x.toString(16).padStart(2, "0")).join("");
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("BLAKE3 Teaching Core", () => {
    it("matches an independent compression replay", () => {
        for (const message of ["", "abc", "The quick brown fox", "a".repeat(64)]) {
            expect(hashOf(message)).toBe(reference(message));
        }
    });

    it("produces a 32-byte output that changes with the input", () => {
        expect(hashOf("abc")).toHaveLength(64);
        expect(hashOf("abc")).not.toBe(hashOf("abd"));
    });

    it("has well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames.length).toBe(9);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
