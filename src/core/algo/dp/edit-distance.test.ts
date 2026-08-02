/**
 * edit-distance.test.ts – Minimum viable test for Edit Distance.
 */

import { describe, expect, it } from "vitest";
import editDistance from "./edit-distance";

describe("EditDistance", () => {
    it("yields at least one frame", () => {
        const generator = editDistance.run(editDistance.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = editDistance.run(editDistance.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
