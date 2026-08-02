/**
 * insertion-sort.test.ts – Minimum viable test for Insertion Sort.
 */

import { describe, expect, it } from "vitest";
import insertionSort from "./insertion-sort";

describe("InsertionSort", () => {
    it("yields at least one frame", () => {
        const generator = insertionSort.run(insertionSort.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = insertionSort.run(insertionSort.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
