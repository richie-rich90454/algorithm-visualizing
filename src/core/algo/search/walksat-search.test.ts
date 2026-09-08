/**
 * walksat-search.test.ts – Minimum viable test for WalkSAT Search.
 */

import { describe, expect, it } from "vitest";
import walksatSearch from "./walksat-search";

describe("WalksatSearch", () => {
    it("yields at least one frame", () => {
        const generator = walksatSearch.run(walksatSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = walksatSearch.run(walksatSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
