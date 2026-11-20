/** proof-of-stake.test.ts - Weighted selection, determinism, distribution, frames. */

import { describe, expect, it } from "vitest";
import mod, { hashToUnit, selectByStake } from "./proof-of-stake";
import type { VisualFrame } from "@/types";

interface Input {
    stakes: number[];
    seed: number;
    rounds: number;
}

/** Independent weighted-roulette selection over the same stakes. */
function reference(stakes: number[], u: number): number {
    const total = stakes.reduce((a, b) => a + b, 0);
    const target = u * total;
    let sum = 0;
    for (let i = 0; i < stakes.length; i += 1) {
        sum += stakes[i] ?? 0;
        if (target < sum) return i;
    }
    return stakes.length - 1;
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Proof of Stake", () => {
    it("each round's proposer matches independent weighted roulette", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.stakes.length);
        const results = frames[frames.length - 1]?.meta["results"] as number[];
        expect(results.length).toBe(input.rounds);
        for (let round = 0; round < input.rounds; round += 1) {
            const frame = frames[round + 1];
            const u = frame?.meta["u"] as number;
            expect(frame?.meta["selected"]).toBe(reference(input.stakes, u));
            expect(results[round]).toBe(reference(input.stakes, u));
        }
    });

    it("is deterministic and never selects a zero-stake validator", () => {
        const stakes = [0, 1, 0, 3];
        for (let round = 0; round < 50; round += 1) {
            const u = hashToUnit(12345, round);
            expect(u).toBe(hashToUnit(12345, round));
            const selected = selectByStake(stakes, u);
            expect(stakes[selected]).toBeGreaterThan(0);
        }
        expect(selectByStake([5], 0.999999)).toBe(0);
    });

    it("approximates stake-proportional frequencies over many draws", () => {
        const stakes = [1, 2, 3];
        const total = 6;
        const draws = 6000;
        const counts = [0, 0, 0];
        for (let round = 0; round < draws; round += 1) {
            const selected = selectByStake(stakes, hashToUnit(777, round));
            counts[selected] = (counts[selected] ?? 0) + 1;
        }
        stakes.forEach((stake, i) => {
            const expected = (stake / total) * draws;
            expect(Math.abs((counts[i] ?? 0) - expected) / expected).toBeLessThan(0.08);
        });
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
