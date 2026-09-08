/**
 * median-of-medians-select.test.ts – Minimum viable test for Median of Medians Select.
 */

import { describe, expect, it } from "vitest";
import medianOfMediansSelect from "./median-of-medians-select";

describe("MedianOfMediansSelect", () => {
    it("yields at least one frame", () => {
        const generator = medianOfMediansSelect.run(medianOfMediansSelect.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = medianOfMediansSelect.run(medianOfMediansSelect.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
