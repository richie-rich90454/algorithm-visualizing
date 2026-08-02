/**
 * red-black-tree.test.ts – Minimum viable test for Red-Black Tree.
 */

import { describe, expect, it } from "vitest";
import redBlackTree from "./red-black-tree";

describe("RedBlackTree", () => {
    it("yields at least one frame", () => {
        const generator = redBlackTree.run(redBlackTree.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = redBlackTree.run(redBlackTree.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
