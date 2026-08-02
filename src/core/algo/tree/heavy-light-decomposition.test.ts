/**
 * heavy-light-decomposition.test.ts – Minimum viable test for HLD.
 */

import { describe, expect, it } from "vitest";
import heavyLightDecomposition from "./heavy-light-decomposition";

describe("HeavyLightDecomposition", () => {
    it("yields at least one frame", () => {
        const generator = heavyLightDecomposition.run(heavyLightDecomposition.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = heavyLightDecomposition.run(heavyLightDecomposition.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
