/**
 * half-plane-intersection.test.ts – Minimum viable test for Half-Plane Intersection.
 */

import { describe, expect, it } from "vitest";
import halfPlaneIntersection from "./half-plane-intersection";

describe("HalfPlaneIntersection", () => {
    it("yields at least one frame", () => {
        const generator = halfPlaneIntersection.run(halfPlaneIntersection.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = halfPlaneIntersection.run(halfPlaneIntersection.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
