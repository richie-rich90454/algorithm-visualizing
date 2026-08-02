/**
 * suffix-tree-ukkonen.test.ts – Minimum viable test for the Suffix Tree.
 */

import { describe, expect, it } from "vitest";
import suffixTreeUkkonen from "./suffix-tree-ukkonen";

describe("SuffixTreeUkkonen", () => {
    it("yields at least one frame", () => {
        const generator = suffixTreeUkkonen.run(suffixTreeUkkonen.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = suffixTreeUkkonen.run(suffixTreeUkkonen.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
