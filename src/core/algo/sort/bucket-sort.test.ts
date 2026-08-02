/**
 * bucket-sort.test.ts – Minimum viable test for Bucket Sort.
 */

import { describe, expect, it } from "vitest";
import bucketSort from "./bucket-sort";

describe("BucketSort", () => {
    it("yields at least one frame", () => {
        const generator = bucketSort.run(bucketSort.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = bucketSort.run(bucketSort.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
