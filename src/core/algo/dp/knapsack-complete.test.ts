/**
 * knapsack-complete.test.ts – Minimum viable test for Unbounded Knapsack.
 */

import { describe, expect, it } from "vitest";
import knapsackComplete from "./knapsack-complete";

describe("KnapsackComplete", () => {
    it("yields at least one frame", () => {
        const generator = knapsackComplete.run(knapsackComplete.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = knapsackComplete.run(knapsackComplete.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
