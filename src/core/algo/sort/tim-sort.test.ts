/**
 * tim-sort.test.ts – Minimum viable test for Tim Sort.
 */

import { describe, expect, it } from "vitest";
import timSort from "./tim-sort";

describe("TimSort", () => {
    it("yields at least one frame", () => {
        const generator = timSort.run(timSort.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = timSort.run(timSort.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
