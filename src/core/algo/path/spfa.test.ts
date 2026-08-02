/**
 * spfa.test.ts – Minimum viable test for SPFA.
 */

import { describe, expect, it } from "vitest";
import spfa from "./spfa";

describe("SPFA", () => {
    it("yields at least one frame", () => {
        const generator = spfa.run(spfa.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = spfa.run(spfa.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
