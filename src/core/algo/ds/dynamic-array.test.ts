/**
 * dynamic-array.test.ts – Minimum viable test for Dynamic Array.
 */

import { describe, expect, it } from "vitest";
import dynamicArray from "./dynamic-array";

describe("DynamicArray", () => {
    it("yields at least one frame", () => {
        const generator = dynamicArray.run(dynamicArray.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = dynamicArray.run(dynamicArray.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
