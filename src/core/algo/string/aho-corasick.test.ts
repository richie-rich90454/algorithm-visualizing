/**
 * aho-corasick.test.ts – Minimum viable test for Aho-Corasick.
 */

import { describe, expect, it } from "vitest";
import ahoCorasick from "./aho-corasick";

describe("AhoCorasick", () => {
    it("yields at least one frame", () => {
        const generator = ahoCorasick.run(ahoCorasick.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = ahoCorasick.run(ahoCorasick.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
