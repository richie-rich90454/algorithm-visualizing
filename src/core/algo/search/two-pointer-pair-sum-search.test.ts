/**
 * two-pointer-pair-sum-search.test.ts – Minimum viable test for Two-Pointer Pair Sum Search.
 */

import { describe, expect, it } from "vitest";
import twoPointerPairSumSearch from "./two-pointer-pair-sum-search";

describe("TwoPointerPairSumSearch", () => {
    it("yields at least one frame", () => {
        const generator = twoPointerPairSumSearch.run(twoPointerPairSumSearch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = twoPointerPairSumSearch.run(twoPointerPairSumSearch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
