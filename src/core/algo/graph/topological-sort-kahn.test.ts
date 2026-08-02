/**
 * topological-sort-kahn.test.ts – Minimum viable test for Topological Sort.
 */

import { describe, expect, it } from "vitest";
import topologicalSortKahn from "./topological-sort-kahn";

describe("TopologicalSortKahn", () => {
    it("yields at least one frame", () => {
        const generator = topologicalSortKahn.run(topologicalSortKahn.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = topologicalSortKahn.run(topologicalSortKahn.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
