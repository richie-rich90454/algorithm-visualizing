/**
 * linked-hash-map.test.ts – Minimum viable test for Linked Hash Map.
 */

import { describe, expect, it } from "vitest";
import linkedHashMap from "./linked-hash-map";

describe("LinkedHashMap", () => {
    it("yields at least one frame", () => {
        const generator = linkedHashMap.run(linkedHashMap.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = linkedHashMap.run(linkedHashMap.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
