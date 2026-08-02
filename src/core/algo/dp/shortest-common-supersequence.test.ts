/**
 * shortest-common-supersequence.test.ts – Minimum viable test for SCS.
 */

import { describe, expect, it } from "vitest";
import shortestCommonSupersequence from "./shortest-common-supersequence";

describe("ShortestCommonSupersequence", () => {
    it("yields at least one frame", () => {
        const generator = shortestCommonSupersequence.run(shortestCommonSupersequence.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = shortestCommonSupersequence.run(shortestCommonSupersequence.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
