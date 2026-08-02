/**
 * tree-dp-independent-set.test.ts – Minimum viable test for Tree DP.
 */

import { describe, expect, it } from "vitest";
import treeDpIndependentSet from "./tree-dp-independent-set";

describe("TreeDpIndependentSet", () => {
    it("yields at least one frame", () => {
        const generator = treeDpIndependentSet.run(treeDpIndependentSet.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = treeDpIndependentSet.run(treeDpIndependentSet.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
