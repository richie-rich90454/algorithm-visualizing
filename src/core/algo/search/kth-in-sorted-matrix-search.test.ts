/**
 * kth-in-sorted-matrix-search.test.ts – Minimum viable test for Kth Smallest in Sorted Matrix.
 */

import { describe, expect, it } from "vitest";
import kthInSortedMatrixSearch from "./kth-in-sorted-matrix-search";

describe("KthInSortedMatrixSearch", () => {
    it("yields at least one frame", () => {
        const generator = kthInSortedMatrixSearch.run(kthInSortedMatrixSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = kthInSortedMatrixSearch.run(kthInSortedMatrixSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
