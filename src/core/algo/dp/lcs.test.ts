/**
 * lcs.test.ts – Minimum viable test for LCS.
 */

import { describe, expect, it } from "vitest";
import lcs from "./lcs";

describe("Lcs", () => {
    it("yields at least one frame", () => {
        const generator = lcs.run(lcs.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = lcs.run(lcs.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
