/**
 * dag-longest-dp.test.ts – Minimum viable test for DAG Longest DP.
 */

import { describe, expect, it } from "vitest";
import dagLongestDp from "./dag-longest-dp";

describe("DagLongestDp", () => {
    it("yields at least one frame", () => {
        const generator = dagLongestDp.run(dagLongestDp.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = dagLongestDp.run(dagLongestDp.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
