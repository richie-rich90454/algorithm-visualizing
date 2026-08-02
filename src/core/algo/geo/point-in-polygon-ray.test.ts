/**
 * point-in-polygon-ray.test.ts – Minimum viable test for Point in Polygon.
 */

import { describe, expect, it } from "vitest";
import pointInPolygonRay from "./point-in-polygon-ray";

describe("PointInPolygonRay", () => {
    it("yields at least one frame", () => {
        const generator = pointInPolygonRay.run(pointInPolygonRay.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = pointInPolygonRay.run(pointInPolygonRay.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
