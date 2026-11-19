/**
 * warp-shuffle-reduction.test.ts - Brute-force sums for every round, halving
 * offsets, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { shuffleReduce } from "./warp-shuffle-reduction";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) expect(entity.type).toBe("bar");
    });
}

function seeded(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) >>> 0;
        return s / 0x100000000;
    };
}

describe("WarpShuffleReduction", () => {
    it("reduces to the direct sum and halves the offset every round", () => {
        const rand = seeded(71);
        for (let trial = 0; trial < 80; trial += 1) {
            const n = 1 + Math.floor(rand() * 16);
            const values = Array.from({ length: n }, () => Math.floor(rand() * 41) - 20);
            const reduced = shuffleReduce(values);
            expect(reduced.result).toBe(values.reduce((a, b) => a + b, 0));
            let expectedOffset = 1;
            while (expectedOffset * 2 < n) expectedOffset *= 2;
            for (const round of reduced.rounds) {
                expect(round.offset).toBe(expectedOffset);
                expectedOffset = Math.floor(expectedOffset / 2);
            }
        }
    });

    it("reports the same result in frames as the pure function", () => {
        const rand = seeded(83);
        for (let trial = 0; trial < 40; trial += 1) {
            const lanes = 2 + Math.floor(rand() * 6) * 2;
            const values = Array.from({ length: lanes }, () => Math.floor(rand() * 19) - 9);
            const frames = [...mod.run({ values, lanes })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["result"]).toBe(values.reduce((a, b) => a + b, 0));
            expect(Number(final?.["rounds"])).toBe(shuffleReduce(values).rounds.length);
            const shuffleFrames = frames.filter((f) => f.meta["phase"] === "shuffle");
            expect(shuffleFrames.length).toBe(shuffleReduce(values).rounds.length);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
