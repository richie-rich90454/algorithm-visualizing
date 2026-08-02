/**
 * radix-sort-msd.test.ts – Minimum viable test for Radix Sort (MSD).
 */

import { describe, expect, it } from "vitest";
import radixSortMsd from "./radix-sort-msd";

describe("RadixSortMsd", () => {
    it("yields at least one frame", () => {
        const generator = radixSortMsd.run(radixSortMsd.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = radixSortMsd.run(radixSortMsd.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
