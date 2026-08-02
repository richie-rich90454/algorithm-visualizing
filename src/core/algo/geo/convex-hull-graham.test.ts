/**
 * convex-hull-graham.test.ts – Minimum viable test for Convex Hull.
 */

import { describe, expect, it } from "vitest";
import convexHullGraham from "./convex-hull-graham";

describe("ConvexHullGraham", () => {
    it("yields at least one frame", () => {
        const generator = convexHullGraham.run(convexHullGraham.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = convexHullGraham.run(convexHullGraham.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
