/**
 * lca-tarjan-offline.test.ts – Minimum viable test for LCA (Tarjan Offline).
 */

import { describe, expect, it } from "vitest";
import lcaTarjanOffline from "./lca-tarjan-offline";

describe("LcaTarjanOffline", () => {
    it("yields at least one frame", () => {
        const generator = lcaTarjanOffline.run(lcaTarjanOffline.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = lcaTarjanOffline.run(lcaTarjanOffline.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
