/**
 * bitmask-tsp.test.ts – Minimum viable test for Bitmask TSP.
 */

import { describe, expect, it } from "vitest";
import bitmaskTsp from "./bitmask-tsp";

describe("BitmaskTsp", () => {
    it("yields at least one frame", () => {
        const generator = bitmaskTsp.run(bitmaskTsp.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = bitmaskTsp.run(bitmaskTsp.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
