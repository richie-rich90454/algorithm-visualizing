/**
 * linear-search.test.ts – Minimum viable test for Linear Search.
 */

import { describe, expect, it } from "vitest";
import linearSearch from "./linear-search";

describe("LinearSearch", () => {
    it("yields at least one frame", () => {
        const generator = linearSearch.run(linearSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = linearSearch.run(linearSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
