/**
 * miller-rabin.test.ts – Minimum viable test for Miller-Rabin.
 */

import { describe, expect, it } from "vitest";
import millerRabin from "./miller-rabin";

describe("MillerRabin", () => {
    it("yields at least one frame", () => {
        const generator = millerRabin.run(millerRabin.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = millerRabin.run(millerRabin.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
