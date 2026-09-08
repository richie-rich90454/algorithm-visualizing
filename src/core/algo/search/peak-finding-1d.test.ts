/**
 * peak-finding-1d.test.ts – Minimum viable test for Peak Finding 1D.
 */

import { describe, expect, it } from "vitest";
import peakFinding1d from "./peak-finding-1d";

describe("PeakFinding1d", () => {
    it("yields at least one frame", () => {
        const generator = peakFinding1d.run(peakFinding1d.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = peakFinding1d.run(peakFinding1d.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
