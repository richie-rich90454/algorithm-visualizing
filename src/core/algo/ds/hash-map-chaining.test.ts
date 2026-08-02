/**
 * hash-map-chaining.test.ts – Minimum viable test for Hash Map (chaining).
 */

import { describe, expect, it } from "vitest";
import hashMapChaining from "./hash-map-chaining";

describe("HashMapChaining", () => {
    it("yields at least one frame", () => {
        const generator = hashMapChaining.run(hashMapChaining.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = hashMapChaining.run(hashMapChaining.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
