/**
 * lis.test.ts – Minimum viable test for LIS.
 */

import { describe, expect, it } from "vitest";
import lis from "./lis";

describe("Lis", () => {
    it("yields at least one frame", () => {
        const generator = lis.run(lis.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = lis.run(lis.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
