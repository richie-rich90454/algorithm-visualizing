/**
 * knapsack-multiple.test.ts – Minimum viable test for Bounded Knapsack.
 */

import { describe, expect, it } from "vitest";
import knapsackMultiple from "./knapsack-multiple";

describe("KnapsackMultiple", () => {
    it("yields at least one frame", () => {
        const generator = knapsackMultiple.run(knapsackMultiple.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = knapsackMultiple.run(knapsackMultiple.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
