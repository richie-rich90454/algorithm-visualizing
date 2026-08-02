/**
 * radix-sort-lsd.test.ts – Minimum viable test for Radix Sort (LSD).
 */

import { describe, expect, it } from "vitest";
import radixSortLsd from "./radix-sort-lsd";

describe("RadixSortLsd", () => {
    it("yields at least one frame", () => {
        const generator = radixSortLsd.run(radixSortLsd.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = radixSortLsd.run(radixSortLsd.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
