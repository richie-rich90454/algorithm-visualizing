/**
 * shortest-path-dag.test.ts – Minimum viable test for Shortest Path in a DAG.
 */

import { describe, expect, it } from "vitest";
import shortestPathDag from "./shortest-path-dag";

describe("ShortestPathDag", () => {
    it("yields at least one frame", () => {
        const generator = shortestPathDag.run(shortestPathDag.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = shortestPathDag.run(shortestPathDag.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
