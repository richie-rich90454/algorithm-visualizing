/**
 * uniform-cost-search.test.ts – Minimum viable test for Uniform-Cost Search.
 */

import { describe, expect, it } from "vitest";
import uniformCostSearch from "./uniform-cost-search";

describe("UniformCostSearch", () => {
    it("yields at least one frame", () => {
        const generator = uniformCostSearch.run(uniformCostSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = uniformCostSearch.run(uniformCostSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
