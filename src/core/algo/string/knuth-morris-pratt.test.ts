/**
 * knuth-morris-pratt.test.ts – Minimum viable test for KMP.
 */

import { describe, expect, it } from "vitest";
import knuthMorrisPratt from "./knuth-morris-pratt";

describe("KnuthMorrisPratt", () => {
    it("yields at least one frame", () => {
        const generator = knuthMorrisPratt.run(knuthMorrisPratt.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = knuthMorrisPratt.run(knuthMorrisPratt.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
