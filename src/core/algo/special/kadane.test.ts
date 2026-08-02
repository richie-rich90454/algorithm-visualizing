/**
 * kadane.test.ts – Minimum viable test for Kadane's Algorithm.
 */

import { describe, expect, it } from "vitest";
import kadane from "./kadane";

describe("Kadane", () => {
    it("yields at least one frame", () => {
        const generator = kadane.run(kadane.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = kadane.run(kadane.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
