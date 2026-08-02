/**
 * segment-tree-lazy.test.ts – Minimum viable test for Lazy Segment Tree.
 */

import { describe, expect, it } from "vitest";
import segmentTreeLazy from "./segment-tree-lazy";

describe("SegmentTreeLazy", () => {
    it("yields at least one frame", () => {
        const generator = segmentTreeLazy.run(segmentTreeLazy.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = segmentTreeLazy.run(segmentTreeLazy.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
