/**
 * second-best-mst.test.ts – Minimum viable test for Second Best MST.
 */

import { describe, expect, it } from "vitest";
import secondBestMst from "./second-best-mst";

describe("SecondBestMst", () => {
    it("yields at least one frame", () => {
        const generator = secondBestMst.run(secondBestMst.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = secondBestMst.run(secondBestMst.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
