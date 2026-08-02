/**
 * point-in-polygon-winding.test.ts – Minimum viable test for Winding.
 */

import { describe, expect, it } from "vitest";
import pointInPolygonWinding from "./point-in-polygon-winding";

describe("PointInPolygonWinding", () => {
    it("yields at least one frame", () => {
        const generator = pointInPolygonWinding.run(pointInPolygonWinding.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = pointInPolygonWinding.run(pointInPolygonWinding.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
