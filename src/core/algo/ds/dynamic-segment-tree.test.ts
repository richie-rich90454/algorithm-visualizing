/**
 * dynamic-segment-tree.test.ts – Minimum viable test for Dynamic Segment Tree.
 */

import { describe, expect, it } from "vitest";
import dynamicSegmentTree from "./dynamic-segment-tree";

describe("DynamicSegmentTree", () => {
    it("yields at least one frame", () => {
        const generator = dynamicSegmentTree.run(dynamicSegmentTree.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = dynamicSegmentTree.run(dynamicSegmentTree.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
