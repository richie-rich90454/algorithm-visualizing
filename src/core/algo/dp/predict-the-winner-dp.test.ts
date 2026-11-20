/**
 * predict-the-winner-dp.test.ts - Brute force, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./predict-the-winner-dp";
import type { VisualFrame } from "@/types";

/** Recursive minimax returning the best advantage for the player to move. */
function brute(scores: number[]): number {
    const solve = (lo: number, hi: number): number => {
        if (lo >= hi) return scores[lo] ?? 0;
        const takeLeft = (scores[lo] ?? 0) - solve(lo + 1, hi);
        const takeRight = (scores[hi] ?? 0) - solve(lo, hi - 1);
        return Math.max(takeLeft, takeRight);
    };
    return scores.length === 0 ? 0 : solve(0, scores.length - 1);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Predict the Winner DP", () => {
    it("matches independent minimax on random small arrays", () => {
        let seed = 777;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % 12;
        };
        for (let trial = 0; trial < 25; trial += 1) {
            const n = 1 + (trial % 6);
            const scores = Array.from({ length: n }, () => rand());
            const frames = [...mod.run({ scores })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["answer"]).toBe(brute(scores));
        }
    });

    it("reports the documented losing margin for the default input", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(-2);
        expect(frames[frames.length - 1]?.meta["winner"]).toBe("second");
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
