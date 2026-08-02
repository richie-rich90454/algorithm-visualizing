/**
 * count-min-sketch.test.ts – Minimum viable test for Count-Min Sketch.
 */

import { describe, expect, it } from "vitest";
import countMinSketch from "./count-min-sketch";

describe("CountMinSketch", () => {
    it("yields at least one frame", () => {
        const generator = countMinSketch.run(countMinSketch.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = countMinSketch.run(countMinSketch.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
