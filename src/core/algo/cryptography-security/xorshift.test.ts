/** xorshift.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./xorshift";
import type { VisualFrame } from "@/types";

/** Independent reference xorshift32 step. */
function referenceStep(state: number): number {
    let x = state >>> 0;
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >>> 17)) >>> 0;
    x = (x ^ (x << 5)) >>> 0;
    return x >>> 0;
}

/** Check that a frame sequence is well formed. */
function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

const sequenceOf = (seed: number, count: number): number[] => {
    const frames = [...mod.run({ seed, count })];
    return frames[frames.length - 1]?.meta["sequence"] as number[];
};

describe("Xorshift32 Generator", () => {
    it("matches the published first output for seed 1", () => {
        const frames = [...mod.run({ seed: 1, count: 1 })];
        checkFrames(frames, 1);
        expect(frames[frames.length - 1]?.meta["sequence"]).toEqual([270369]);
    });

    it("matches an independent reference for many seeds", () => {
        for (const seed of [1, 2, 3, 42, 123456789, 0xffffffff]) {
            const count = 25;
            const frames = [...mod.run({ seed, count })];
            checkFrames(frames, count);
            const expected: number[] = [];
            let state = seed >>> 0;
            for (let i = 0; i < count; i += 1) {
                state = referenceStep(state);
                expected.push(state);
            }
            expect(frames[frames.length - 1]?.meta["sequence"]).toEqual(expected);
            expect(frames[frames.length - 1]?.meta["state"]).toBe(state);
        }
    });

    it("never repeats or returns zero over a long run and normalizes a zero seed", () => {
        const long = sequenceOf(1, 200);
        expect(new Set(long).size).toBe(200);
        expect(long.every((value) => value !== 0)).toBe(true);
        const zeroSeed = [...mod.run({ seed: 0, count: 2 })];
        expect(zeroSeed[0]?.meta["seed"]).toBe(1);
        expect(zeroSeed[zeroSeed.length - 1]?.meta["sequence"]).toEqual([270369, referenceStep(270369)]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
