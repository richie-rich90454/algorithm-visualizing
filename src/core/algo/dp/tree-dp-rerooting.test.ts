/**
 * tree-dp-rerooting.test.ts – Minimum viable test for Tree DP Rerooting.
 */

import { describe, expect, it } from "vitest";
import treeDpRerooting from "./tree-dp-rerooting";

describe("TreeDpRerooting", () => {
    it("yields at least one frame", () => {
        const generator = treeDpRerooting.run(treeDpRerooting.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = treeDpRerooting.run(treeDpRerooting.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
