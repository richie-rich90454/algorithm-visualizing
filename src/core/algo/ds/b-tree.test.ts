/**
 * b-tree.test.ts – Minimum viable test for B-Tree.
 */

import { describe, expect, it } from "vitest";
import bTree from "./b-tree";

describe("BTree", () => {
    it("yields at least one frame", () => {
        const generator = bTree.run(bTree.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = bTree.run(bTree.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
