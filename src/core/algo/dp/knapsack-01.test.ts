/**
 * knapsack-01.test.ts – Minimum viable test for 0/1 Knapsack.
 */

import { describe, expect, it } from "vitest";
import knapsack01 from "./knapsack-01";

describe("Knapsack01", () => {
    it("yields at least one frame", () => {
        const generator = knapsack01.run(knapsack01.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = knapsack01.run(knapsack01.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
