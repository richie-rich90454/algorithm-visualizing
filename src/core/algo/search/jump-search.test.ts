/**
 * jump-search.test.ts – Minimum viable test for Jump Search.
 */

import { describe, expect, it } from "vitest";
import jumpSearch from "./jump-search";

describe("JumpSearch", () => {
    it("yields at least one frame", () => {
        const generator = jumpSearch.run(jumpSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = jumpSearch.run(jumpSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
