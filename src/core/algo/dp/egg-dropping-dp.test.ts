/**
 * egg-dropping-dp.test.ts - Coverage-formula cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./egg-dropping-dp";
import type { VisualFrame } from "@/types";

/** Maximum floors distinguishable with `eggs` eggs and `trials` drops. */
function coverage(eggs: number, trials: number): number {
    let total = 0;
    let binomial = 1; // C(trials, 0)
    for (let i = 1; i <= eggs; i += 1) {
        binomial = (binomial * (trials - (i - 1))) / i;
        total += binomial;
    }
    return total;
}

/** Independent answer: the fewest trials whose coverage reaches floors. */
function brute(eggs: number, floors: number): number {
    if (floors <= 0) return 0;
    let trials = 0;
    while (coverage(eggs, trials) < floors) trials += 1;
    return trials;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    const lines = mod.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => e.metadata["row"] !== undefined && e.metadata["col"] !== undefined)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber!).toBeLessThan(lines);
        expect(frame.meta).toBeDefined();
    });
}

function answerFor(eggs: number, floors: number): number {
    const frames = [...mod.run({ eggs, floors })];
    checkFrames(frames);
    return Number(frames[frames.length - 1]?.meta["answer"]);
}

describe("Egg Dropping (DP)", () => {
    it("matches the independent coverage formula on the default input", () => {
        const input = mod.defaultInput as { eggs: number; floors: number };
        expect(answerFor(input.eggs, input.floors)).toBe(brute(input.eggs, input.floors));
    });

    it("agrees with brute force across a grid of small inputs", () => {
        for (let eggs = 1; eggs <= 5; eggs += 1) {
            for (let floors = 0; floors <= 24; floors += 1) {
                expect(answerFor(eggs, floors)).toBe(brute(eggs, floors));
            }
        }
    });

    it("has a monotone dp table and exact base cases", () => {
        const frames = [...mod.run({ eggs: 3, floors: 10 })];
        const dp = frames[frames.length - 1]?.meta["dp"] as number[][];
        expect(dp.length).toBe(4);
        for (let e = 1; e <= 3; e += 1) {
            expect(dp[e]?.[0]).toBe(0);
            expect(dp[e]?.[1]).toBe(1);
            for (let f = 2; f <= 10; f += 1) {
                expect(dp[e]![f]!).toBeGreaterThanOrEqual(dp[e]![f - 1]!);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
