/**
 * polygon-area-shoelace.test.ts – Minimum viable test for Shoelace.
 */

import { describe, expect, it } from "vitest";
import polygonAreaShoelace from "./polygon-area-shoelace";

describe("PolygonAreaShoelace", () => {
    it("yields at least one frame", () => {
        const generator = polygonAreaShoelace.run(polygonAreaShoelace.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = polygonAreaShoelace.run(polygonAreaShoelace.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
