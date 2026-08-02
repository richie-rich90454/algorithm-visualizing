/**
 * min-cut.test.ts – Minimum viable test for Min Cut.
 */

import { describe, expect, it } from "vitest";
import minCut from "./min-cut";

describe("MinCut", () => {
    it("yields at least one frame", () => {
        const generator = minCut.run(minCut.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = minCut.run(minCut.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
