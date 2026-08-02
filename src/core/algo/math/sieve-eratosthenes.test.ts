/**
 * sieve-eratosthenes.test.ts – Minimum viable test for the Sieve.
 */

import { describe, expect, it } from "vitest";
import sieveEratosthenes from "./sieve-eratosthenes";

describe("SieveEratosthenes", () => {
    it("yields at least one frame", () => {
        const generator = sieveEratosthenes.run(sieveEratosthenes.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = sieveEratosthenes.run(sieveEratosthenes.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
