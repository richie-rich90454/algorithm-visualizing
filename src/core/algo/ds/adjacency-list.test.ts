/**
 * adjacency-list.test.ts – Minimum viable test for Adjacency List.
 */

import { describe, expect, it } from "vitest";
import adjacencyList from "./adjacency-list";

describe("AdjacencyList", () => {
    it("yields at least one frame", () => {
        const generator = adjacencyList.run(adjacencyList.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = adjacencyList.run(adjacencyList.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
