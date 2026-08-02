/**
 * incidence-matrix.test.ts – Minimum viable test for Incidence Matrix.
 */

import { describe, expect, it } from "vitest";
import incidenceMatrix from "./incidence-matrix";

describe("IncidenceMatrix", () => {
    it("yields at least one frame", () => {
        const generator = incidenceMatrix.run(incidenceMatrix.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = incidenceMatrix.run(incidenceMatrix.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
