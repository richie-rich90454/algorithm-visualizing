/**
 * tree-euler-tour.test.ts – Minimum viable test for Tree Euler Tour.
 */

import { describe, expect, it } from "vitest";
import treeEulerTour from "./tree-euler-tour";

describe("TreeEulerTour", () => {
    it("yields at least one frame", () => {
        const generator = treeEulerTour.run(treeEulerTour.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = treeEulerTour.run(treeEulerTour.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
