/**
 * first-missing-positive-search.test.ts – Minimum viable test for First Missing Positive Search.
 */

import { describe, expect, it } from "vitest";
import firstMissingPositiveSearch from "./first-missing-positive-search";

describe("FirstMissingPositiveSearch", () => {
    it("yields at least one frame", () => {
        const generator = firstMissingPositiveSearch.run(firstMissingPositiveSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = firstMissingPositiveSearch.run(firstMissingPositiveSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
