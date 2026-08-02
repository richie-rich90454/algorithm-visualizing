/**
 * ternary-search-trie.test.ts – Minimum viable test for TST.
 */

import { describe, expect, it } from "vitest";
import ternarySearchTrie from "./ternary-search-trie";

describe("TernarySearchTrie", () => {
    it("yields at least one frame", () => {
        const generator = ternarySearchTrie.run(ternarySearchTrie.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = ternarySearchTrie.run(ternarySearchTrie.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
