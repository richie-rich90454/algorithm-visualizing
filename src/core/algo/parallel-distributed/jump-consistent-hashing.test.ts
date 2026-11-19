/**
 * jump-consistent-hashing.test.ts - Reference chain, minimal-disruption
 * property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./jump-consistent-hashing";
import type { VisualFrame } from "@/types";

const M = 2862933555777941757n;
const T = 2147483648n;

/** Independent reference for one key using BigInt arithmetic. */
function referenceJump(key: number, buckets: number, seed: number): number {
    let state = BigInt.asUintN(64, BigInt(Math.trunc(key)) ^ BigInt(Math.trunc(seed)));
    let b = -1n;
    let j = 0n;
    while (j < BigInt(buckets)) {
        b = j;
        state = BigInt.asUintN(64, state * M + 1n);
        j = ((b + 1n) * T) / ((state >> 33n) + 1n);
    }
    return Number(b);
}

function checkFrames(frames: VisualFrame[], buckets: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(buckets);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("jump consistent hashing", () => {
    it("matches a reference implementation", () => {
        const input = mod.defaultInput as { keys: number[]; buckets: number; seed: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.buckets);
        const perKeyFrames = frames.slice(1, 1 + input.keys.length);
        input.keys.forEach((key, index) => {
            const bucket = perKeyFrames[index]?.meta["bucket"];
            expect(bucket).toBe(referenceJump(key, input.buckets, input.seed));
            expect(bucket).toBeGreaterThanOrEqual(0);
            expect(bucket).toBeLessThan(input.buckets);
        });
    });

    it("moves only to the new bucket when the bucket count grows", () => {
        const keyCount = 500;
        for (let buckets = 1; buckets < 40; buckets += 1) {
            for (let key = 0; key < keyCount; key += 1) {
                const before = referenceJump(key, buckets, 0);
                const after = referenceJump(key, buckets + 1, 0);
                expect(after === before || after === buckets).toBe(true);
            }
        }
    });

    it("is deterministic for a fixed key and seed", () => {
        for (let key = 0; key < 100; key += 1) {
            expect(referenceJump(key, 64, 0)).toBe(referenceJump(key, 64, 0));
            const first = [...mod.run({ keys: [key], buckets: 64, seed: 0 })];
            const second = [...mod.run({ keys: [key], buckets: 64, seed: 0 })];
            expect(first[1]?.meta["bucket"]).toBe(second[1]?.meta["bucket"]);
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
