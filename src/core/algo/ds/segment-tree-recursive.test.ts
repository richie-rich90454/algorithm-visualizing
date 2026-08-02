/**
 * segment-tree-recursive.test.ts – Minimum viable test for Segment Tree.
 */

import { describe, expect, it } from "vitest";
import segmentTreeRecursive from "./segment-tree-recursive";

describe("SegmentTreeRecursive", () => {
    it("yields at least one frame", () => {
        const generator = segmentTreeRecursive.run(segmentTreeRecursive.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = segmentTreeRecursive.run(segmentTreeRecursive.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
