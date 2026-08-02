/**
 * tarjan-bridges.test.ts – Minimum viable test for Tarjan Bridges.
 */

import { describe, expect, it } from "vitest";
import tarjanBridges from "./tarjan-bridges";

describe("TarjanBridges", () => {
    it("yields at least one frame", () => {
        const generator = tarjanBridges.run(tarjanBridges.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = tarjanBridges.run(tarjanBridges.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
