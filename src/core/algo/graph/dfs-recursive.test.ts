/**
 * dfs-recursive.test.ts – Minimum viable test for DFS (Recursive).
 */

import { describe, expect, it } from "vitest";
import dfsRecursive from "./dfs-recursive";

describe("DfsRecursive", () => {
    it("yields at least one frame", () => {
        const generator = dfsRecursive.run(dfsRecursive.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = dfsRecursive.run(dfsRecursive.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
