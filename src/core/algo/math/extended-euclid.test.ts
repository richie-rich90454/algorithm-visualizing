/**
 * extended-euclid.test.ts – Minimum viable test for Extended Euclid.
 */

import { describe, expect, it } from "vitest";
import extendedEuclid from "./extended-euclid";

describe("ExtendedEuclid", () => {
    it("yields at least one frame", () => {
        const generator = extendedEuclid.run(extendedEuclid.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = extendedEuclid.run(extendedEuclid.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
