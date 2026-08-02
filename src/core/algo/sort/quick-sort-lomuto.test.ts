/**
 * quicksort-lomuto.test.ts – Minimum viable test for Quick Sort (Lomuto).
 */

import { describe, expect, it } from "vitest";
import quickSortLomuto from "./quick-sort-lomuto";

describe("QuickSortLomuto", () => {
    it("yields at least one frame", () => {
        const generator = quickSortLomuto.run(quickSortLomuto.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = quickSortLomuto.run(quickSortLomuto.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
