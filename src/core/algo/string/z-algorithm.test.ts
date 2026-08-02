/**
 * z-algorithm.test.ts – Minimum viable test for the Z-Algorithm.
 */

import { describe, expect, it } from "vitest";
import zAlgorithm from "./z-algorithm";

describe("ZAlgorithm", () => {
    it("yields at least one frame", () => {
        const generator = zAlgorithm.run(zAlgorithm.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = zAlgorithm.run(zAlgorithm.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
