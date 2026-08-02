/**
 * gabow-scc.test.ts – Minimum viable test for Gabow SCC.
 */

import { describe, expect, it } from "vitest";
import gabowScc from "./gabow-scc";

describe("GabowScc", () => {
    it("yields at least one frame", () => {
        const generator = gabowScc.run(gabowScc.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = gabowScc.run(gabowScc.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
