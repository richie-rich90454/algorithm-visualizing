/**
 * majority-vote-search.test.ts – Minimum viable test for Majority Vote Search.
 */

import { describe, expect, it } from "vitest";
import majorityVoteSearch from "./majority-vote-search";

describe("MajorityVoteSearch", () => {
    it("yields at least one frame", () => {
        const generator = majorityVoteSearch.run(majorityVoteSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = majorityVoteSearch.run(majorityVoteSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
