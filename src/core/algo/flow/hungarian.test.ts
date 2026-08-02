/**
 * hungarian.test.ts – Minimum viable test for the Hungarian Algorithm.
 */

import { describe, expect, it } from "vitest";
import hungarian from "./hungarian";

describe("Hungarian", () => {
    it("yields at least one frame", () => {
        const generator = hungarian.run(hungarian.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = hungarian.run(hungarian.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
