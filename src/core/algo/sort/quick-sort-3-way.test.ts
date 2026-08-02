/**
 * quicksort-3way.test.ts – Minimum viable test for Quick Sort (3-Way).
 */

import { describe, expect, it } from "vitest";
import quickSort3Way from "./quick-sort-3-way";

describe("QuickSort3Way", () => {
    it("yields at least one frame", () => {
        const generator = quickSort3Way.run(quickSort3Way.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = quickSort3Way.run(quickSort3Way.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
