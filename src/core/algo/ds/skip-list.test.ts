/**
 * skip-list.test.ts – Minimum viable test for Skip List.
 */

import { describe, expect, it } from "vitest";
import skipList from "./skip-list";

describe("SkipList", () => {
    it("yields at least one frame", () => {
        const generator = skipList.run(skipList.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = skipList.run(skipList.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
