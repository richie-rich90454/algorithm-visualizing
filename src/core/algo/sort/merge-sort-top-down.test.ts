/**
 * merge-sort-top-down.test.ts – Minimum viable test for Merge Sort (Top-Down).
 */

import { describe, expect, it } from "vitest";
import mergeSortTopDown from "./merge-sort-top-down";

describe("MergeSortTopDown", () => {
    it("yields at least one frame", () => {
        const generator = mergeSortTopDown.run(mergeSortTopDown.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = mergeSortTopDown.run(mergeSortTopDown.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
