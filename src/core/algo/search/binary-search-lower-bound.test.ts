/**
 * binary-search-lower-bound.test.ts – Minimum viable test for Lower Bound.
 */

import { describe, expect, it } from "vitest";
import binarySearchLowerBound from "./binary-search-lower-bound";

describe("BinarySearchLowerBound", () => {
    it("yields at least one frame", () => {
        const generator = binarySearchLowerBound.run(binarySearchLowerBound.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = binarySearchLowerBound.run(binarySearchLowerBound.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
