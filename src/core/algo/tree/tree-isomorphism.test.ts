/**
 * tree-isomorphism.test.ts – Minimum viable test for Tree Isomorphism.
 */

import { describe, expect, it } from "vitest";
import treeIsomorphism from "./tree-isomorphism";

describe("TreeIsomorphism", () => {
    it("yields at least one frame", () => {
        const generator = treeIsomorphism.run(treeIsomorphism.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = treeIsomorphism.run(treeIsomorphism.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
