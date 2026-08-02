/**
 * las-vegas.test.ts – Minimum viable test for Las Vegas.
 */

import { describe, expect, it } from "vitest";
import lasVegas from "./las-vegas";

describe("LasVegas", () => {
    it("yields at least one frame", () => {
        const generator = lasVegas.run(lasVegas.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = lasVegas.run(lasVegas.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
