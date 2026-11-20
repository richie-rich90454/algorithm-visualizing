/** cityhash.test.ts - Reference digest, diffusion properties, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./cityhash";
import type { VisualFrame } from "@/types";

const MASK = 0xffffffffffffffffn;
const K0 = 0xc3a5c85c97cb3127n;
const K1 = 0xb492b66fbe98f273n;
const K2 = 0x9ae16a3b2f90404fn;
const mul = (a: bigint, b: bigint): bigint => (a * b) & MASK;
const rot = (x: bigint, s: bigint): bigint => ((x >> s) | (x << (64n - s))) & MASK;

/** Independent reimplementation of the mixer for reference checks. */
function reference(bytes: Uint8Array): bigint {
    const fetch = (pos: number): bigint => {
        let v = 0n;
        for (let i = 0; i < 8; i += 1) {
            const b = bytes[pos + i];
            if (b === undefined) break;
            v |= BigInt(b) << BigInt(8 * i);
        }
        return v;
    };
    const mix = (u: bigint, v: bigint, m: bigint): bigint => {
        let a = mul(u ^ v, m);
        a ^= a >> 47n;
        let b = mul(v ^ a, m);
        b ^= b >> 47n;
        return mul(b, m);
    };
    let h = K2 ^ BigInt(bytes.length);
    let pos = 0;
    while (pos + 16 <= bytes.length) {
        h = rot(mix((h + fetch(pos)) & MASK, fetch(pos + 8), K1), 27n);
        pos += 16;
    }
    while (pos < bytes.length) {
        h = mix(h ^ BigInt(bytes[pos] as number), BigInt(bytes.length) ^ K0, K2);
        pos += 1;
    }
    h ^= h >> 33n;
    h = mul(h, K1);
    h ^= h >> 29n;
    h = mul(h, K2);
    return (h ^ (h >> 32n)) & MASK;
}

const digestOf = (frames: VisualFrame[]): string => String((frames[frames.length - 1] as VisualFrame).meta["digest"]);
const bytesOf = (s: string): Uint8Array => new TextEncoder().encode(s);

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("CityHash-style 64-bit hash", () => {
    it("matches an independent mixer on many inputs", () => {
        const samples = ["", "a", "ab", "algorithm-visualizing", "hello world", "z".repeat(80), "mixed CASE 123 !@#"];
        for (let seed = 0; seed < 40; seed += 1) samples.push(`sample-${seed}-${"x".repeat(seed)}`);
        for (const text of samples) {
            const digest = digestOf([...mod.run({ text })]);
            expect(digest).toBe(reference(bytesOf(text)).toString(16).padStart(16, "0"));
        }
    });

    it("is deterministic", () => {
        for (const text of ["abc", "abc", "abc"]) {
            expect(digestOf([...mod.run({ text })])).toBe(digestOf([...mod.run({ text })]));
        }
    });

    it("spreads a single input bit change across roughly half the output bits", () => {
        let total = 0;
        const trials = 120;
        for (let i = 0; i < trials; i += 1) {
            const base = `diffusion-${i}`;
            const changed = `${base.slice(0, -1)}${String.fromCharCode(base.charCodeAt(base.length - 1) as number ^ 1)}`;
            const a = BigInt(`0x${digestOf([...mod.run({ text: base })])}`);
            const b = BigInt(`0x${digestOf([...mod.run({ text: changed })])}`);
            let diff = 0;
            let x = a ^ b;
            while (x > 0n) {
                diff += Number(x & 1n);
                x >>= 1n;
            }
            total += diff;
        }
        const average = total / trials;
        expect(average).toBeGreaterThan(20);
        expect(average).toBeLessThan(44);
    });

    it("keeps a low collision rate over distinct inputs", () => {
        const seen = new Set<string>();
        for (let i = 0; i < 1500; i += 1) {
            seen.add(digestOf([...mod.run({ text: `key-${i}` })]));
        }
        expect(seen.size).toBe(1500);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
