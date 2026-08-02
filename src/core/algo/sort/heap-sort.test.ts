/**
 * heap-sort.test.ts – Minimum viable test for Heap Sort.
 */

import { describe, expect, it } from "vitest";
import heapSort from "./heap-sort";

describe("HeapSort", () => {
    it("yields at least one frame", () => {
        const generator = heapSort.run(heapSort.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = heapSort.run(heapSort.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
