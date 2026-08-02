/**
 * convex-hull-monotone.test.ts – Minimum viable test for Monotone Chain.
 */

import { describe, expect, it } from "vitest";
import convexHullMonotone from "./convex-hull-monotone";

describe("ConvexHullMonotone", () => {
    it("yields at least one frame", () => {
        const generator = convexHullMonotone.run(convexHullMonotone.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = convexHullMonotone.run(convexHullMonotone.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
