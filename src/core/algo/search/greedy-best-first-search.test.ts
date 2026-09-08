/**
 * greedy-best-first-search.test.ts – Minimum viable test for Greedy Best-First Search.
 */

import { describe, expect, it } from "vitest";
import greedyBestFirstSearch from "./greedy-best-first-search";

describe("GreedyBestFirstSearch", () => {
    it("yields at least one frame", () => {
        const generator = greedyBestFirstSearch.run(greedyBestFirstSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = greedyBestFirstSearch.run(greedyBestFirstSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
