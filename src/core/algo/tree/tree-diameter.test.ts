/**
 * tree-diameter.test.ts – Minimum viable test for Tree Diameter.
 */

import { describe, expect, it } from "vitest";
import treeDiameter from "./tree-diameter";

describe("TreeDiameter", () => {
    it("yields at least one frame", () => {
        const generator = treeDiameter.run(treeDiameter.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = treeDiameter.run(treeDiameter.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
