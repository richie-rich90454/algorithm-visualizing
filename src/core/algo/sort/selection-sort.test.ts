/**
 * selection-sort.test.ts – Minimum viable test for Selection Sort.
 *
 * Verifies the generator yields at least one well-formed frame from the
 * module's own default input, and that the run terminates cleanly.
 */

import { describe, expect, it } from "vitest";
import selectionSort from "./selection-sort";

describe("SelectionSort", () => {
    it("yields at least one frame", () => {
        const generator = selectionSort.run(selectionSort.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = selectionSort.run(selectionSort.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
