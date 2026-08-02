/**
 * persistent-segment-tree.test.ts – Minimum viable test for Persistent Segment Tree.
 */

import { describe, expect, it } from "vitest";
import persistentSegmentTree from "./persistent-segment-tree";

describe("PersistentSegmentTree", () => {
    it("yields at least one frame", () => {
        const generator = persistentSegmentTree.run(persistentSegmentTree.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = persistentSegmentTree.run(persistentSegmentTree.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
