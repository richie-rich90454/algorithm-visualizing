/**
 * subset-sum.test.ts – Minimum viable test for Subset Sum.
 */

import { describe, expect, it } from "vitest";
import subsetSum from "./subset-sum";

describe("SubsetSum", () => {
    it("yields at least one frame", () => {
        const generator = subsetSum.run(subsetSum.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = subsetSum.run(subsetSum.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
