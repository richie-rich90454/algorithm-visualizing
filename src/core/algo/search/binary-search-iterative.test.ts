/**
 * binary-search-iterative.test.ts – Minimum viable test for Binary Search.
 */

import { describe, expect, it } from "vitest";
import binarySearchIterative from "./binary-search-iterative";

describe("BinarySearchIterative", () => {
    it("yields at least one frame", () => {
        const generator = binarySearchIterative.run(binarySearchIterative.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = binarySearchIterative.run(binarySearchIterative.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
