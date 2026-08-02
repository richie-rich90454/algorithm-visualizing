/**
 * dfs-iterative.test.ts – Minimum viable test for DFS (Iterative).
 */

import { describe, expect, it } from "vitest";
import dfsIterative from "./dfs-iterative";

describe("DfsIterative", () => {
    it("yields at least one frame", () => {
        const generator = dfsIterative.run(dfsIterative.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = dfsIterative.run(dfsIterative.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
