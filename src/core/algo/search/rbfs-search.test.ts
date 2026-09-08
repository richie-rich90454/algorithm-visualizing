/**
 * rbfs-search.test.ts – Minimum viable test for RBFS Search.
 */

import { describe, expect, it } from "vitest";
import rbfsSearch from "./rbfs-search";

describe("RbfsSearch", () => {
    it("yields at least one frame", () => {
        const generator = rbfsSearch.run(rbfsSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = rbfsSearch.run(rbfsSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
