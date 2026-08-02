/**
 * convex-hull-jarvis.test.ts – Minimum viable test for Jarvis march.
 */

import { describe, expect, it } from "vitest";
import convexHullJarvis from "./convex-hull-jarvis";

describe("ConvexHullJarvis", () => {
    it("yields at least one frame", () => {
        const generator = convexHullJarvis.run(convexHullJarvis.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = convexHullJarvis.run(convexHullJarvis.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
