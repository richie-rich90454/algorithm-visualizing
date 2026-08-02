/**
 * lexicographic-bfs.test.ts – Minimum viable test for Lexicographic BFS.
 */

import { describe, expect, it } from "vitest";
import lexicographicBfs from "./lexicographic-bfs";

describe("LexicographicBfs", () => {
    it("yields at least one frame", () => {
        const generator = lexicographicBfs.run(lexicographicBfs.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = lexicographicBfs.run(lexicographicBfs.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
