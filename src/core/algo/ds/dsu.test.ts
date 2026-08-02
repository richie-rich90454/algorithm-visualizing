/**
 * dsu.test.ts – Minimum viable test for DSU.
 */

import { describe, expect, it } from "vitest";
import dsu from "./dsu";

describe("Dsu", () => {
    it("yields at least one frame", () => {
        const generator = dsu.run(dsu.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = dsu.run(dsu.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
