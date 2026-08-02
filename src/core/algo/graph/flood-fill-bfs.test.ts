/**
 * flood-fill-bfs.test.ts – Minimum viable test for Flood Fill (BFS).
 */

import { describe, expect, it } from "vitest";
import floodFillBfs from "./flood-fill-bfs";

describe("FloodFillBfs", () => {
    it("yields at least one frame", () => {
        const generator = floodFillBfs.run(floodFillBfs.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = floodFillBfs.run(floodFillBfs.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
