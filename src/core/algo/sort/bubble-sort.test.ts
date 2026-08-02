/**
 * bubble-sort.test.ts – Minimum viable test for Bubble Sort.
 *
 * The plan requires every algorithm module to verify its generator yields at
 * least one frame. This test drives the generator with the module's own
 * default input and checks that the first yielded value is a well-formed
 * `VisualFrame` carrying an entities array.
 */

import { describe, expect, it } from "vitest";
import bubbleSort from "./bubble-sort";

describe("BubbleSort", () => {
    it("yields at least one frame", () => {
        const generator = bubbleSort.run(bubbleSort.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = bubbleSort.run(bubbleSort.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
