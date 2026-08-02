/**
 * centroid-decomposition.test.ts – Minimum viable test for Centroid Decomposition.
 */

import { describe, expect, it } from "vitest";
import centroidDecomposition from "./centroid-decomposition";

describe("CentroidDecomposition", () => {
    it("yields at least one frame", () => {
        const generator = centroidDecomposition.run(centroidDecomposition.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = centroidDecomposition.run(centroidDecomposition.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
