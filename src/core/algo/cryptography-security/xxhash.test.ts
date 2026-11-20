/** xxhash.test.ts - Independent BigInt XXH32 reference, published vector, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./xxhash";
import type { VisualFrame } from "@/types";

const MASK = (1n << 32n) - 1n;
const P1 = 2654435761n;
const P2 = 2246822519n;
const P3 = 3266489917n;
const P4 = 668265263n;
const P5 = 374761393n;

const rotl = (x: bigint, n: number): bigint =>
    (((x << BigInt(n)) | (x >> BigInt(32 - n))) & MASK);

/** Independent XXH32 reference using BigInt arithmetic. */
function reference(text: string, seedInput: number): number {
    const bytes = Array.from(new TextEncoder().encode(text));
    const seed = BigInt(seedInput >>> 0);
    const read32 = (i: number): bigint =>
        BigInt(bytes[i] ?? 0) |
        (BigInt(bytes[i + 1] ?? 0) << 8n) |
        (BigInt(bytes[i + 2] ?? 0) << 16n) |
        (BigInt(bytes[i + 3] ?? 0) << 24n);
    const round = (acc: bigint, input: bigint): bigint =>
        (rotl((acc + ((input * P2) & MASK)) & MASK, 13) * P1) & MASK;

    let i = 0;
    let h: bigint;
    if (bytes.length >= 16) {
        let a = (seed + P1 + P2) & MASK;
        let b = (seed + P2) & MASK;
        let c = seed;
        let d = (seed - P1 + (1n << 32n)) & MASK;
        while (i + 16 <= bytes.length) {
            a = round(a, read32(i));
            b = round(b, read32(i + 4));
            c = round(c, read32(i + 8));
            d = round(d, read32(i + 12));
            i += 16;
        }
        h = (rotl(a, 1) + rotl(b, 7) + rotl(c, 12) + rotl(d, 18)) & MASK;
    } else {
        h = (seed + P5) & MASK;
    }
    h = (h + BigInt(bytes.length)) & MASK;
    while (i + 4 <= bytes.length) {
        h = (rotl((h + ((read32(i) * P3) & MASK)) & MASK, 17) * P4) & MASK;
        i += 4;
    }
    while (i < bytes.length) {
        h = (rotl((h + ((BigInt(bytes[i] ?? 0) * P5) & MASK)) & MASK, 11) * P1) & MASK;
        i += 1;
    }
    h ^= h >> 15n;
    h = (h * P2) & MASK;
    h ^= h >> 13n;
    h = (h * P3) & MASK;
    h ^= h >> 16n;
    return Number(h & MASK) >>> 0;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(typeof frame.meta["digest"]).toBe("string");
    });
}

describe("XXH32 Hash", () => {
    it("matches the published empty-string test vector", () => {
        const frames = [...mod.run({ message: "", seed: 0 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["digest"]).toBe("02cc5d05");
    });

    it("matches the independent reference across many inputs and seeds", () => {
        const inputs = [
            "",
            "a",
            "abc",
            "hello world",
            "abcdabcdabcdabcd",
            "The quick brown fox jumps over the lazy dog",
            "x".repeat(31),
            "y".repeat(32),
            "z".repeat(33),
            "mix-1234567890-abcdefghijklmnopqrstuvwxyz",
        ];
        const seeds = [0, 1, 7, 2654435761, 4294967295];
        for (const message of inputs) {
            for (const seed of seeds) {
                const frames = [...mod.run({ message, seed })];
                const digest = String(frames[frames.length - 1]?.meta["digest"]);
                expect(digest).toBe(reference(message, seed).toString(16).padStart(8, "0"));
            }
        }
    });

    it("is deterministic and avalanche-sensitive", () => {
        const first = [...mod.run({ message: "abc", seed: 3 })];
        const second = [...mod.run({ message: "abc", seed: 3 })];
        expect(first[first.length - 1]?.meta["digest"]).toBe(second[second.length - 1]?.meta["digest"]);
        const changed = [...mod.run({ message: "abd", seed: 3 })];
        expect(first[first.length - 1]?.meta["digest"]).not.toBe(changed[changed.length - 1]?.meta["digest"]);
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
