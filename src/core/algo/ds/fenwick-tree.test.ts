/**
 * fenwick-tree.test.ts – Minimum viable test for Fenwick Tree.
 */

import { describe, expect, it } from "vitest";
import fenwickTree from "./fenwick-tree";

describe("FenwickTree", () => {
    it("yields at least one frame", () => {
        const generator = fenwickTree.run(fenwickTree.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = fenwickTree.run(fenwickTree.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
