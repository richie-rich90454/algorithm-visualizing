/**
 * digit-dp.test.ts – Minimum viable test for Digit DP.
 */

import { describe, expect, it } from "vitest";
import digitDp from "./digit-dp";

describe("DigitDp", () => {
    it("yields at least one frame", () => {
        const generator = digitDp.run(digitDp.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = digitDp.run(digitDp.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
