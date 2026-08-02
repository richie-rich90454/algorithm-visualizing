/**
 * lucas-theorem.test.ts – Minimum viable test for Lucas's Theorem.
 */

import { describe, expect, it } from "vitest";
import lucasTheorem from "./lucas-theorem";

describe("LucasTheorem", () => {
    it("yields at least one frame", () => {
        const generator = lucasTheorem.run(lucasTheorem.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = lucasTheorem.run(lucasTheorem.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
