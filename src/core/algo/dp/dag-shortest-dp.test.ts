/**
 * dag-shortest-dp.test.ts – Minimum viable test for DAG Shortest DP.
 */

import { describe, expect, it } from "vitest";
import dagShortestDp from "./dag-shortest-dp";

describe("DagShortestDp", () => {
    it("yields at least one frame", () => {
        const generator = dagShortestDp.run(dagShortestDp.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = dagShortestDp.run(dagShortestDp.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
