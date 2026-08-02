/**
 * fenwick-tree-range.test.ts – Minimum viable test for Fenwick Tree (Range).
 */

import { describe, expect, it } from "vitest";
import fenwickTreeRange from "./fenwick-tree-range";

describe("FenwickTreeRange", () => {
    it("yields at least one frame", () => {
        const generator = fenwickTreeRange.run(fenwickTreeRange.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = fenwickTreeRange.run(fenwickTreeRange.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
