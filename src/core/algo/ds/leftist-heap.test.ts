/**
 * leftist-heap.test.ts – Minimum viable test for Leftist Heap.
 */

import { describe, expect, it } from "vitest";
import leftistHeap from "./leftist-heap";

describe("LeftistHeap", () => {
    it("yields at least one frame", () => {
        const generator = leftistHeap.run(leftistHeap.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = leftistHeap.run(leftistHeap.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
