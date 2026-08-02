/**
 * binary-search-recursive.test.ts – Minimum viable test for Binary Search.
 */

import { describe, expect, it } from "vitest";
import binarySearchRecursive from "./binary-search-recursive";

describe("BinarySearchRecursive", () => {
    it("yields at least one frame", () => {
        const generator = binarySearchRecursive.run(binarySearchRecursive.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = binarySearchRecursive.run(binarySearchRecursive.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
