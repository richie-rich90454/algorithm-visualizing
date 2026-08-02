/**
 * edge-list.test.ts – Minimum viable test for Edge List.
 */

import { describe, expect, it } from "vitest";
import edgeList from "./edge-list";

describe("EdgeList", () => {
    it("yields at least one frame", () => {
        const generator = edgeList.run(edgeList.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = edgeList.run(edgeList.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
