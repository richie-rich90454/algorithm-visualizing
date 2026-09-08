/**
 * branch-and-bound-search.test.ts – Minimum viable test for Branch and Bound Search.
 */

import { describe, expect, it } from "vitest";
import branchAndBoundSearch from "./branch-and-bound-search";

describe("BranchAndBoundSearch", () => {
    it("yields at least one frame", () => {
        const generator = branchAndBoundSearch.run(branchAndBoundSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = branchAndBoundSearch.run(branchAndBoundSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
