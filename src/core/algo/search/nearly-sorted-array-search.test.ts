/**
 * nearly-sorted-array-search.test.ts – Minimum viable test for Nearly Sorted Array Search.
 */

import { describe, expect, it } from "vitest";
import nearlySortedArraySearch from "./nearly-sorted-array-search";

describe("NearlySortedArraySearch", () => {
    it("yields at least one frame", () => {
        const generator = nearlySortedArraySearch.run(nearlySortedArraySearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = nearlySortedArraySearch.run(nearlySortedArraySearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
