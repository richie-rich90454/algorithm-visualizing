/**
 * euclid-gcd.test.ts – Minimum viable test for Euclid's GCD.
 */

import { describe, expect, it } from "vitest";
import euclidGcd from "./euclid-gcd";

describe("EuclidGcd", () => {
    it("yields at least one frame", () => {
        const generator = euclidGcd.run(euclidGcd.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = euclidGcd.run(euclidGcd.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
