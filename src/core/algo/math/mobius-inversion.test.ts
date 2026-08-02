/**
 * mobius-inversion.test.ts – Minimum viable test for Möbius Inversion.
 */

import { describe, expect, it } from "vitest";
import mobiusInversion from "./mobius-inversion";

describe("MobiusInversion", () => {
    it("yields at least one frame", () => {
        const generator = mobiusInversion.run(mobiusInversion.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = mobiusInversion.run(mobiusInversion.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
