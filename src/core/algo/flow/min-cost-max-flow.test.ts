/**
 * min-cost-max-flow.test.ts – Minimum viable test for Min-Cost Max-Flow.
 */

import { describe, expect, it } from "vitest";
import minCostMaxFlow from "./min-cost-max-flow";

describe("MinCostMaxFlow", () => {
    it("yields at least one frame", () => {
        const generator = minCostMaxFlow.run(minCostMaxFlow.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = minCostMaxFlow.run(minCostMaxFlow.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
