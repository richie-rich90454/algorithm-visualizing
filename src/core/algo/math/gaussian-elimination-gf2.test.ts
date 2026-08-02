/**
 * gaussian-elimination-gf2.test.ts – Minimum viable test for GF(2) elimination.
 */

import { describe, expect, it } from "vitest";
import gaussianEliminationGf2 from "./gaussian-elimination-gf2";

describe("GaussianEliminationGf2", () => {
    it("yields at least one frame", () => {
        const generator = gaussianEliminationGf2.run(gaussianEliminationGf2.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = gaussianEliminationGf2.run(gaussianEliminationGf2.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
