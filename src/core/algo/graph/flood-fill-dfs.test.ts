/**
 * flood-fill-dfs.test.ts – Minimum viable test for Flood Fill (DFS).
 */

import { describe, expect, it } from "vitest";
import floodFillDfs from "./flood-fill-dfs";

describe("FloodFillDfs", () => {
    it("yields at least one frame", () => {
        const generator = floodFillDfs.run(floodFillDfs.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = floodFillDfs.run(floodFillDfs.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
