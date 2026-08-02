/**
 * tarjan-articulation-points.test.ts – Minimum viable test for Articulation Points.
 */

import { describe, expect, it } from "vitest";
import tarjanArticulationPoints from "./tarjan-articulation-points";

describe("TarjanArticulationPoints", () => {
    it("yields at least one frame", () => {
        const generator = tarjanArticulationPoints.run(tarjanArticulationPoints.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = tarjanArticulationPoints.run(tarjanArticulationPoints.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
