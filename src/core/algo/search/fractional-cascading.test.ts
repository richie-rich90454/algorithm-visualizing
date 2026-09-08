/**
 * fractional-cascading.test.ts – Minimum viable test for Fractional Cascading.
 */

import { describe, expect, it } from "vitest";
import fractionalCascading from "./fractional-cascading";

describe("FractionalCascading", () => {
    it("yields at least one frame", () => {
        const generator = fractionalCascading.run(fractionalCascading.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = fractionalCascading.run(fractionalCascading.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
