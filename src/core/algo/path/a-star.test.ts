/**
 * a-star.test.ts – Minimum viable test for A*.
 */

import { describe, expect, it } from "vitest";
import aStar from "./a-star";

describe("AStar", () => {
    it("yields at least one frame", () => {
        const generator = aStar.run(aStar.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = aStar.run(aStar.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
