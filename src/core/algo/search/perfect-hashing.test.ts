/**
 * perfect-hashing.test.ts - Collision-free property check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./perfect-hashing";
import type { VisualFrame } from "@/types";

interface Result {
    prime: number;
    firstA: number;
    firstB: number;
    buckets: number[];
    secondA: number[];
    secondB: number[];
    secondSize: number[];
    totalSlots: number;
}

function checkFrames(frames: VisualFrame[], buckets: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(buckets);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function verify(input: { keys: number[]; seed?: number }): void {
    const frames = [...mod.run(input)];
    const keys = [...new Set(input.keys)];
    checkFrames(frames, keys.length);
    const final = frames[frames.length - 1]?.meta as unknown as Result;
    const p = Number(final.prime);
    const a = Number(final.firstA);
    const b = Number(final.firstB);
    const occupied = new Set<string>();
    for (const key of keys) {
        const bucket = ((a * key + b) % p) % keys.length;
        const sA = Number(final.secondA[bucket]);
        const sB = Number(final.secondB[bucket]);
        const size = Number(final.secondSize[bucket]);
        const slot = ((sA * key + sB) % p) % size;
        const address = `${bucket}:${slot}`;
        expect(occupied.has(address)).toBe(false);
        occupied.add(address);
    }
    expect(final.buckets.reduce((sum, size) => sum + size, 0)).toBe(keys.length);
    final.buckets.forEach((size, index) => {
        expect(Number(final.secondSize[index])).toBe(size * size);
    });
    expect(Number(final.totalSlots)).toBe(keys.length + final.secondSize.reduce((sum, size) => sum + size, 0));
}

describe("PerfectHashing", () => {
    it("maps every default key to a distinct slot", () => {
        verify(mod.defaultInput as { keys: number[]; seed: number });
    });

    it("stays collision-free across varied key sets and seeds", () => {
        const cases: Array<{ keys: number[]; seed: number }> = [
            { keys: [1], seed: 1 },
            { keys: [5, 9], seed: 2 },
            { keys: [3, 17, 29, 42, 58], seed: 77 },
            { keys: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], seed: 123 },
            { keys: [100, 200, 300, 400, 500, 600, 700], seed: 999 },
        ];
        for (const testCase of cases) {
            verify(testCase);
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
