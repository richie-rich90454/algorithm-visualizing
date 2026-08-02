/**
 * wythoff.test.ts – Minimum viable test for Wythoff's Game.
 */

import { describe, expect, it } from "vitest";
import wythoff from "./wythoff";

describe("Wythoff", () => {
    it("yields at least one frame", () => {
        const generator = wythoff.run(wythoff.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = wythoff.run(wythoff.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
