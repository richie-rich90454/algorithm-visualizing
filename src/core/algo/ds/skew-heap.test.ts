/**
 * skew-heap.test.ts – Minimum viable test for Skew Heap.
 */

import { describe, expect, it } from "vitest";
import skewHeap from "./skew-heap";

describe("SkewHeap", () => {
    it("yields at least one frame", () => {
        const generator = skewHeap.run(skewHeap.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = skewHeap.run(skewHeap.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
