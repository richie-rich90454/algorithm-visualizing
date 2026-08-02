/**
 * hash-map-open.test.ts – Minimum viable test for Hash Map (open addressing).
 */

import { describe, expect, it } from "vitest";
import hashMapOpen from "./hash-map-open";

describe("HashMapOpen", () => {
    it("yields at least one frame", () => {
        const generator = hashMapOpen.run(hashMapOpen.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = hashMapOpen.run(hashMapOpen.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
