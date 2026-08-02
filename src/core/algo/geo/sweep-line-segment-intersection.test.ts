/**
 * sweep-line-segment-intersection.test.ts – Minimum viable test.
 */

import { describe, expect, it } from "vitest";
import sweepLineSegmentIntersection from "./sweep-line-segment-intersection";

describe("SweepLineSegmentIntersection", () => {
    it("yields at least one frame", () => {
        const generator = sweepLineSegmentIntersection.run(
            sweepLineSegmentIntersection.defaultInput,
        );
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = sweepLineSegmentIntersection.run(
            sweepLineSegmentIntersection.defaultInput,
        );
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
