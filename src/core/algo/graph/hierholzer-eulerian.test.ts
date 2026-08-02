/**
 * hierholzer-eulerian.test.ts – Minimum viable test for Hierholzer Eulerian.
 */

import { describe, expect, it } from "vitest";
import hierholzerEulerian from "./hierholzer-eulerian";

describe("HierholzerEulerian", () => {
    it("yields at least one frame", () => {
        const generator = hierholzerEulerian.run(hierholzerEulerian.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = hierholzerEulerian.run(hierholzerEulerian.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
