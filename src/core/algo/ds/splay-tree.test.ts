/**
 * splay-tree.test.ts – Minimum viable test for Splay Tree.
 */

import { describe, expect, it } from "vitest";
import splayTree from "./splay-tree";

describe("SplayTree", () => {
    it("yields at least one frame", () => {
        const generator = splayTree.run(splayTree.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = splayTree.run(splayTree.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
