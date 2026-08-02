/**
 * blossom.test.ts – Minimum viable test for the Blossom Algorithm.
 */

import { describe, expect, it } from "vitest";
import blossom from "./blossom";

describe("Blossom", () => {
    it("yields at least one frame", () => {
        const generator = blossom.run(blossom.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = blossom.run(blossom.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
