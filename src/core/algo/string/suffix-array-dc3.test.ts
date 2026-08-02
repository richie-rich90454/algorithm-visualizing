/**
 * suffix-array-dc3.test.ts – Minimum viable test for Suffix Array (DC3).
 */

import { describe, expect, it } from "vitest";
import suffixArrayDc3 from "./suffix-array-dc3";

describe("SuffixArrayDc3", () => {
    it("yields at least one frame", () => {
        const generator = suffixArrayDc3.run(suffixArrayDc3.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = suffixArrayDc3.run(suffixArrayDc3.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
