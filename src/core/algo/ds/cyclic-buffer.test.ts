/**
 * cyclic-buffer.test.ts – Minimum viable test for Cyclic Buffer.
 */

import { describe, expect, it } from "vitest";
import cyclicBuffer from "./cyclic-buffer";

describe("CyclicBuffer", () => {
    it("yields at least one frame", () => {
        const generator = cyclicBuffer.run(cyclicBuffer.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = cyclicBuffer.run(cyclicBuffer.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
