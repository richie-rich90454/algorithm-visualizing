/**
 * closest-pair-of-points.test.ts – Minimum viable test for Closest Pair.
 */

import { describe, expect, it } from "vitest";
import closestPairOfPoints from "./closest-pair-of-points";

describe("ClosestPairOfPoints", () => {
    it("yields at least one frame", () => {
        const generator = closestPairOfPoints.run(closestPairOfPoints.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = closestPairOfPoints.run(closestPairOfPoints.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
