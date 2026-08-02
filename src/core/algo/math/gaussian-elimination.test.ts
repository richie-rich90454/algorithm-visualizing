/**
 * gaussian-elimination.test.ts – Minimum viable test for Gaussian Elimination.
 */

import { describe, expect, it } from "vitest";
import gaussianElimination from "./gaussian-elimination";

describe("GaussianElimination", () => {
    it("yields at least one frame", () => {
        const generator = gaussianElimination.run(gaussianElimination.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = gaussianElimination.run(gaussianElimination.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
