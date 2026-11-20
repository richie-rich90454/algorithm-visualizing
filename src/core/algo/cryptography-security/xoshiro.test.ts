/** xoshiro.test.ts - Independent BigInt reference, known stream, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./xoshiro";
import type { VisualFrame } from "@/types";

const MASK = (1n << 64n) - 1n;
const m = (v: bigint): bigint => v & MASK;
const rotl = (v: bigint, k: bigint): bigint => m((v << k) | (v >> (64n - k)));

function seed(seedValue: number): bigint[] {
    let cursor = BigInt(seedValue >>> 0);
    const out: bigint[] = [];
    for (let i = 0; i < 4; i += 1) {
        cursor = m(cursor + 0x9e3779b97f4a7c15n);
        let z = cursor;
        z = m((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n);
        z = m((z ^ (z >> 27n)) * 0x94d049bb133111ebn);
        out.push(m(z ^ (z >> 31n)));
    }
    return out;
}

function referenceStream(seedValue: number, draws: number): string[] {
    const s = seed(seedValue);
    const out: string[] = [];
    for (let i = 0; i < draws; i += 1) {
        const s0 = s[0] ?? 0n;
        const s1 = s[1] ?? 0n;
        const s2 = s[2] ?? 0n;
        const s3 = s[3] ?? 0n;
        const result = m(rotl(m(s1 * 5n), 7n) * 9n);
        const t = m(s1 << 17n);
        const ns2 = m(s2 ^ s0);
        const ns3 = m(s3 ^ s1);
        const ns1 = m(s1 ^ ns2);
        const ns0 = m(s0 ^ ns3);
        s[2] = m(ns2 ^ t);
        s[3] = rotl(ns3, 45n);
        s[1] = ns1;
        s[0] = ns0;
        out.push(result.toString(16).padStart(16, "0"));
    }
    return out;
}

function checkFrames(frames: VisualFrame[], draws: number): void {
    expect(frames.length).toBe(draws + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(Math.min(index, draws));
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Xoshiro", () => {
    it("matches an independent BigInt reference for many seeds", () => {
        for (const seedValue of [0, 1, 7, 12345, 0xdeadbeef]) {
            const draws = 12;
            const frames = [...mod.run({ seed: seedValue, draws })];
            checkFrames(frames, draws);
            const outputs = frames[frames.length - 1]?.meta["outputs"] as string[];
            expect(outputs).toEqual(referenceStream(seedValue, draws));
        }
    });

    it("produces distinct, reproducible outputs for a fixed seed", () => {
        const once = [...mod.run({ seed: 1, draws: 5 })].pop()?.meta["outputs"] as string[];
        const twice = [...mod.run({ seed: 1, draws: 5 })].pop()?.meta["outputs"] as string[];
        expect(once).toEqual(twice);
        expect(new Set(once).size).toBe(5);
        expect(once.every((value) => /^[0-9a-f]{16}$/.test(value))).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) { count += 1; }
        expect(count).toBe(10);
        expect(generator.next().done).toBe(true);
    });
});
