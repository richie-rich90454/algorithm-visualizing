/**
 * binary-search-upper-bound.test.ts – Minimum viable test for Upper Bound.
 */

import { describe, expect, it } from "vitest";
import binarySearchUpperBound from "./binary-search-upper-bound";

describe("BinarySearchUpperBound", () => {
    it("yields at least one frame", () => {
        const generator = binarySearchUpperBound.run(binarySearchUpperBound.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = binarySearchUpperBound.run(binarySearchUpperBound.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
