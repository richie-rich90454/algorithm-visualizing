/**
 * rotating-calipers.test.ts – Minimum viable test for Rotating Calipers.
 */

import { describe, expect, it } from "vitest";
import rotatingCalipers from "./rotating-calipers";

describe("RotatingCalipers", () => {
    it("yields at least one frame", () => {
        const generator = rotatingCalipers.run(rotatingCalipers.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = rotatingCalipers.run(rotatingCalipers.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
