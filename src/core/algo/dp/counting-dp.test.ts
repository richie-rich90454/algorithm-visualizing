/**
 * counting-dp.test.ts – Minimum viable test for Counting DP.
 */

import { describe, expect, it } from "vitest";
import countingDp from "./counting-dp";

describe("CountingDp", () => {
    it("yields at least one frame", () => {
        const generator = countingDp.run(countingDp.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = countingDp.run(countingDp.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
