/**
 * ac3-arc-consistency.test.ts – Minimum viable test for AC-3 Arc Consistency.
 */

import { describe, expect, it } from "vitest";
import ac3ArcConsistency from "./ac3-arc-consistency";

describe("Ac3ArcConsistency", () => {
    it("yields at least one frame", () => {
        const generator = ac3ArcConsistency.run(ac3ArcConsistency.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = ac3ArcConsistency.run(ac3ArcConsistency.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
