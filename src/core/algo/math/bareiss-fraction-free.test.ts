/**
 * bareiss-fraction-free.test.ts – Minimum viable test for Bareiss.
 */

import { describe, expect, it } from "vitest";
import bareissFractionFree from "./bareiss-fraction-free";

describe("BareissFractionFree", () => {
    it("yields at least one frame", () => {
        const generator = bareissFractionFree.run(bareissFractionFree.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = bareissFractionFree.run(bareissFractionFree.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
