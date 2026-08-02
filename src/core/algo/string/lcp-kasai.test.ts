/**
 * lcp-kasai.test.ts – Minimum viable test for the LCP (Kasai) array.
 */

import { describe, expect, it } from "vitest";
import lcpKasai from "./lcp-kasai";

describe("LcpKasai", () => {
    it("yields at least one frame", () => {
        const generator = lcpKasai.run(lcpKasai.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = lcpKasai.run(lcpKasai.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
