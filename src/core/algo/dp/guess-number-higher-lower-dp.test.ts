/**
 * guess-number-higher-lower-dp.test.ts - Brute force, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./guess-number-higher-lower-dp";
import type { VisualFrame } from "@/types";

/** Exhaustive minimax over every possible first guess and all replies. */
function brute(costs: number[]): number {
    const solve = (lo: number, hi: number): number => {
        if (lo > hi) return 0;
        if (lo === hi) return costs[lo] ?? 0;
        let best = Infinity;
        for (let g = lo; g <= hi; g += 1) {
            const worse = Math.max(solve(lo, g - 1), solve(g + 1, hi));
            best = Math.min(best, (costs[g] ?? 0) + worse);
        }
        return best;
    };
    return costs.length === 0 ? 0 : solve(0, costs.length - 1);
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

describe("Guess Number Higher or Lower DP", () => {
    it("matches exhaustive minimax on random cost arrays", () => {
        let seed = 2468;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return 1 + (seed % 9);
        };
        for (let trial = 0; trial < 15; trial += 1) {
            const n = 1 + (trial % 6);
            const costs = Array.from({ length: n }, () => rand());
            const frames = [...mod.run({ costs })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["answer"]).toBe(brute(costs));
        }
    });

    it("reports the documented default answer of 6", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(6);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
