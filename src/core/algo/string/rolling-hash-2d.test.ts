/**
 * rolling-hash-2d.test.ts – Minimum viable test for the 2D Rolling Hash.
 */

import { describe, expect, it } from "vitest";
import rollingHash2d from "./rolling-hash-2d";

describe("RollingHash2d", () => {
    it("yields at least one frame", () => {
        const generator = rollingHash2d.run(rollingHash2d.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = rollingHash2d.run(rollingHash2d.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
