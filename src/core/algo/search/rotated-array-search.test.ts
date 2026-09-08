/**
 * rotated-array-search.test.ts – Minimum viable test for Rotated Array Search.
 */

import { describe, expect, it } from "vitest";
import rotatedArraySearch from "./rotated-array-search";

describe("RotatedArraySearch", () => {
    it("yields at least one frame", () => {
        const generator = rotatedArraySearch.run(rotatedArraySearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = rotatedArraySearch.run(rotatedArraySearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
