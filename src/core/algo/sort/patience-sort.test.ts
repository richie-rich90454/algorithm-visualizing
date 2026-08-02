/**
 * patience-sort.test.ts – Minimum viable test for Patience Sort.
 */

import { describe, expect, it } from "vitest";
import patienceSort from "./patience-sort";

describe("PatienceSort", () => {
    it("yields at least one frame", () => {
        const generator = patienceSort.run(patienceSort.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = patienceSort.run(patienceSort.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
