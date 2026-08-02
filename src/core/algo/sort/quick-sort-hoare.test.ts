/**
 * quicksort-hoare.test.ts – Minimum viable test for Quick Sort (Hoare).
 */

import { describe, expect, it } from "vitest";
import quickSortHoare from "./quick-sort-hoare";

describe("QuickSortHoare", () => {
    it("yields at least one frame", () => {
        const generator = quickSortHoare.run(quickSortHoare.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = quickSortHoare.run(quickSortHoare.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
