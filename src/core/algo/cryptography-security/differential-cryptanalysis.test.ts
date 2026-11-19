/**
 * differential-cryptanalysis.test.ts - Independent cipher reference, brute-force
 * differential distribution, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./differential-cryptanalysis";
import type { VisualFrame } from "@/types";

const SBOX = [14, 4, 13, 1, 2, 15, 11, 8, 3, 10, 6, 12, 5, 9, 0, 7];
const nibs = (v: number): number[] => [(v >> 12) & 15, (v >> 8) & 15, (v >> 4) & 15, v & 15];
const sub = (v: number): number => {
    const n = nibs(v);
    return (SBOX[n[0]!]! << 12) | (SBOX[n[1]!]! << 8) | (SBOX[n[2]!]! << 4) | SBOX[n[3]!]!;
};
const perm = (v: number): number => {
    const n = nibs(v);
    return ((n[0]! << 12) | (n[2]! << 8) | (n[1]! << 4) | n[3]!);
};
const addKey = (v: number, k: number, r: number): number => (v ^ ((k + 0x1111 * r) & 0xffff)) & 0xffff;
const hex = (v: number): string => (v & 0xffff).toString(16).padStart(4, "0");
const encrypt = (v: number, key: number, rounds: number): number => {
    let s = v;
    for (let r = 0; r < rounds; r += 1) {
        s = addKey(perm(sub(s)), key, r);
    }
    return s;
};

function bestOneRound(diff: number, key: number): { bestDiff: number; bestCount: number } {
    const counts = new Map<number, number>();
    for (let base = 0; base < 0x10000; base += 1) {
        const delta = encrypt(base, key, 1) ^ encrypt(base ^ diff, key, 1);
        counts.set(delta, (counts.get(delta) ?? 0) + 1);
    }
    let bestDiff = 0;
    let bestCount = -1;
    for (const [d, c] of counts) {
        if (c > bestCount) {
            bestDiff = d;
            bestCount = c;
        }
    }
    return { bestDiff, bestCount };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("differential cryptanalysis", () => {
    it("matches an independent cipher for the output difference", () => {
        const cases = [
            { plaintext: "0x0000", diff: "0x1000", key: "0xabcd", rounds: 2 },
            { plaintext: "0x1234", diff: "0x00f0", key: "0xbeef", rounds: 3 },
            { plaintext: "0xffff", diff: "0x0001", key: "0x1234", rounds: 1 },
        ];
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames);
            const p = Number.parseInt(c.plaintext, 16);
            const d = Number.parseInt(c.diff, 16);
            const k = Number.parseInt(c.key, 16);
            const want = encrypt(p, k, c.rounds) ^ encrypt(p ^ d, k, c.rounds);
            expect(frames[frames.length - 1]?.meta["outputDiff"]).toBe(hex(want));
        }
    });

    it("finds the exact best one-round differential by brute force", () => {
        const input = { plaintext: "0x0000", diff: "0x1000", key: "0xabcd", rounds: 1 };
        const frames = [...mod.run(input)];
        const last = frames[frames.length - 1]?.meta;
        const want = bestOneRound(0x1000, 0xabcd);
        expect(last?.["bestDiff"]).toBe(hex(want.bestDiff));
        expect(last?.["bestCount"]).toBe(want.bestCount);
        expect(last?.["totalPairs"]).toBe(0x10000);
        expect(Number(last?.["bestCount"])).toBeLessThan(0x10000);
    });

    it("key addition does not change a pair's difference", () => {
        const frames = [...mod.run({ plaintext: "0x0000", diff: "0x1000", key: "0xabcd", rounds: 1 })];
        const diffs = frames[frames.length - 1]?.meta["roundDiffs"] as string[];
        // Sub-box and permutation can change it, but the final key-add frame
        // must equal the permutation frame immediately before it.
        expect(diffs[1]).toBe(diffs[2]);
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
