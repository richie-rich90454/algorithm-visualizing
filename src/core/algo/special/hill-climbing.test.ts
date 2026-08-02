/**
 * hill-climbing.test.ts – Minimum viable test for Hill Climbing.
 */

import { describe, expect, it } from "vitest";
import hillClimbing from "./hill-climbing";

describe("HillClimbing", () => {
    it("yields at least one frame", () => {
        const generator = hillClimbing.run(hillClimbing.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = hillClimbing.run(hillClimbing.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
