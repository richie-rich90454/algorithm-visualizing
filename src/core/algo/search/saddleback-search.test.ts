/**
 * saddleback-search.test.ts – Minimum viable test for Saddleback Search.
 */

import { describe, expect, it } from "vitest";
import saddlebackSearch from "./saddleback-search";

describe("SaddlebackSearch", () => {
    it("yields at least one frame", () => {
        const generator = saddlebackSearch.run(saddlebackSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = saddlebackSearch.run(saddlebackSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
