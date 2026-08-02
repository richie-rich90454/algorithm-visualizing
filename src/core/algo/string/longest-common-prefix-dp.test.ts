/**
 * longest-common-prefix-dp.test.ts – Minimum viable test for LCP DP.
 */

import { describe, expect, it } from "vitest";
import longestCommonPrefixDp from "./longest-common-prefix-dp";

describe("LongestCommonPrefixDp", () => {
    it("yields at least one frame", () => {
        const generator = longestCommonPrefixDp.run(longestCommonPrefixDp.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = longestCommonPrefixDp.run(longestCommonPrefixDp.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
