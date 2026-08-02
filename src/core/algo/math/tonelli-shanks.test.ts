/**
 * tonelli-shanks.test.ts – Minimum viable test for Tonelli-Shanks.
 */

import { describe, expect, it } from "vitest";
import tonelliShanks from "./tonelli-shanks";

describe("TonelliShanks", () => {
    it("yields at least one frame", () => {
        const generator = tonelliShanks.run(tonelliShanks.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = tonelliShanks.run(tonelliShanks.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
