/**
 * tree-center.test.ts – Minimum viable test for Tree Center.
 */

import { describe, expect, it } from "vitest";
import treeCenter from "./tree-center";

describe("TreeCenter", () => {
    it("yields at least one frame", () => {
        const generator = treeCenter.run(treeCenter.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = treeCenter.run(treeCenter.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
