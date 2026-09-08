/**
 * ida-star-search.test.ts – Minimum viable test for IDA* Search.
 */

import { describe, expect, it } from "vitest";
import idaStarSearch from "./ida-star-search";

describe("IdaStarSearch", () => {
    it("yields at least one frame", () => {
        const generator = idaStarSearch.run(idaStarSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = idaStarSearch.run(idaStarSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
