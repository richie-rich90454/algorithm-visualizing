/**
 * interpolation-search.test.ts – Minimum viable test for Interpolation Search.
 */

import { describe, expect, it } from "vitest";
import interpolationSearch from "./interpolation-search";

describe("InterpolationSearch", () => {
    it("yields at least one frame", () => {
        const generator = interpolationSearch.run(interpolationSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = interpolationSearch.run(interpolationSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
