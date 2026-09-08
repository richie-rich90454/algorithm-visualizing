/**
 * sublist-search.test.ts – Minimum viable test for Sublist Search.
 */

import { describe, expect, it } from "vitest";
import sublistSearch from "./sublist-search";

describe("SublistSearch", () => {
    it("yields at least one frame", () => {
        const generator = sublistSearch.run(sublistSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = sublistSearch.run(sublistSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
