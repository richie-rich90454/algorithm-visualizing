/**
 * merge-sort-bottom-up.test.ts – Minimum viable test for Merge Sort (Bottom-Up).
 */

import { describe, expect, it } from "vitest";
import mergeSortBottomUp from "./merge-sort-bottom-up";

describe("MergeSortBottomUp", () => {
    it("yields at least one frame", () => {
        const generator = mergeSortBottomUp.run(mergeSortBottomUp.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = mergeSortBottomUp.run(mergeSortBottomUp.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
