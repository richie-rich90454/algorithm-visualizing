/**
 * law-of-large-numbers.test.ts - Running-average property, convergence,
 * frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./law-of-large-numbers";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
    expect(frames[0]?.entities.length).toBe(0);
    for (let i = 1; i <= n; i += 1) {
        expect(frames[i]?.entities.length).toBe(i);
    }
    expect(frames[frames.length - 1]?.entities.length).toBe(n);
}

describe("law of large numbers", () => {
    it("keeps every running average equal to the prefix sum over count", () => {
        const frames = [...mod.run({ n: 60, seed: 7, distribution: "dice" })];
        checkFrames(frames, 60);
        const last = frames[frames.length - 1]?.meta;
        const draws = last?.["draws"] as number[];
        const averages = last?.["averages"] as number[];
        let sum = 0;
        for (let i = 0; i < draws.length; i += 1) {
            sum += draws[i]!;
            expect(averages[i]).toBeCloseTo(sum / (i + 1), 12);
            expect(draws[i]!).toBeGreaterThanOrEqual(1);
            expect(draws[i]!).toBeLessThanOrEqual(6);
        }
    });

    it("converges to the true mean for both distributions", () => {
        const dice = [...mod.run({ n: 2000, seed: 42, distribution: "dice" })];
        checkFrames(dice, 2000);
        const diceMean = Number(dice[dice.length - 1]?.meta["runningAverage"]);
        expect(Math.abs(diceMean - 3.5)).toBeLessThan(0.2);

        const coin = [...mod.run({ n: 2000, seed: 11, distribution: "bernoulli", p: 0.3 })];
        checkFrames(coin, 2000);
        const coinMean = Number(coin[coin.length - 1]?.meta["runningAverage"]);
        expect(Math.abs(coinMean - 0.3)).toBeLessThan(0.05);
    });

    it("is reproducible for a fixed seed", () => {
        const a = [...mod.run({ n: 30, seed: 99, distribution: "dice" })];
        const b = [...mod.run({ n: 30, seed: 99, distribution: "dice" })];
        expect(a[a.length - 1]?.meta["draws"]).toEqual(b[b.length - 1]?.meta["draws"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(102);
        expect(generator.next().done).toBe(true);
    });
});
