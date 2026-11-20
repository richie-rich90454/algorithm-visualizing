/**
 * ulid-generation.test.ts - Independent base-32 decode round trips and the
 * lexicographic-sort property, plus frame-shape and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./ulid-generation";
import type { VisualFrame } from "@/types";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RANDOM_MASK = (1n << 80n) - 1n;

/** Independent Crockford base-32 decoder. */
function decode(ulid: string): { timestamp: bigint; random: bigint } {
    let value = 0n;
    for (const char of ulid) {
        const digit = ALPHABET.indexOf(char);
        expect(digit).toBeGreaterThanOrEqual(0);
        value = (value << 5n) | BigInt(digit);
    }
    return { timestamp: value >> 80n, random: value & RANDOM_MASK };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.entities.length).toBe(frame.meta["count"]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        for (const entity of frame.entities) {
            const ulid = String(entity.metadata["ulid"]);
            expect(ulid).toHaveLength(26);
            expect(entity.label).toBe(ulid);
            expect(ALPHABET.includes(ulid[0] ?? "")).toBe(true);
            expect(ALPHABET.indexOf(ulid[0] ?? "")).toBeLessThanOrEqual(7);
            for (const char of ulid) {
                expect(ALPHABET.includes(char)).toBe(true);
            }
        }
    });
}

describe("ULID Generation", () => {
    it("round-trips every generated ULID back to its timestamp and random bits", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const ulids = meta["ulids"] as string[];
        const timestamps = meta["timestamps"] as number[];
        const randoms = meta["randoms"] as string[];

        expect(ulids.length).toBe(timestamps.length);
        for (let i = 0; i < ulids.length; i += 1) {
            const decoded = decode(ulids[i] ?? "");
            expect(decoded.timestamp).toBe(BigInt(timestamps[i] ?? -1));
            expect(decoded.random).toBe(BigInt(`0x${randoms[i]}`));
        }
    });

    it("sorts lexicographically in timestamp then random order", () => {
        const input = { timestamps: [1600000000002, 1600000000000, 1600000000001, 1600000000000], seed: 7 };
        const frames = [...mod.run(input)];
        const meta = frames[frames.length - 1]?.meta;
        const ulids = meta["ulids"] as string[];
        const sorted = meta["sortedUlids"] as string[];

        expect(sorted).toEqual([...ulids].sort());
        const decodedSorted = sorted.map((u) => decode(u));
        for (let i = 1; i < decodedSorted.length; i += 1) {
            const prev = decodedSorted[i - 1]!;
            const cur = decodedSorted[i]!;
            expect(cur.timestamp >= prev.timestamp).toBe(true);
            if (cur.timestamp === prev.timestamp) {
                expect(cur.random >= prev.random).toBe(true);
            }
        }
    });

    it("produces distinct identifiers for many seeds", () => {
        const timestamps = Array.from({ length: 12 }, (_, i) => 1600000000000 + (i % 3));
        const meta = [...mod.run({ timestamps, seed: 99 })].at(-1)?.meta;
        const ulids = meta?.["ulids"] as string[];
        expect(new Set(ulids).size).toBe(ulids.length);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
