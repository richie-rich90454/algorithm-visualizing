/**
 * peak-finding-2d.test.ts – Minimum viable test for Peak Finding 2D.
 */

import { describe, expect, it } from "vitest";
import peakFinding2d from "./peak-finding-2d";

describe("PeakFinding2d", () => {
    it("yields at least one frame", () => {
        const generator = peakFinding2d.run(peakFinding2d.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = peakFinding2d.run(peakFinding2d.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
