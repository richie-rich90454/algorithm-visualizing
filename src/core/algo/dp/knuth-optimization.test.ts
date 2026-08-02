/**
 * knuth-optimization.test.ts – Minimum viable test for Knuth's Optimization.
 */

import { describe, expect, it } from "vitest";
import knuthOptimization from "./knuth-optimization";

describe("KnuthOptimization", () => {
    it("yields at least one frame", () => {
        const generator = knuthOptimization.run(knuthOptimization.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = knuthOptimization.run(knuthOptimization.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
