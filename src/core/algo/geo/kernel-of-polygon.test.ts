/**
 * kernel-of-polygon.test.ts – Minimum viable test.
 */
import { describe, expect, it } from "vitest";
import kernel from "./kernel-of-polygon";

describe("KernelOfPolygon", () => {
    it("yields at least one frame", () => {
        const generator = kernel.run(kernel.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = kernel.run(kernel.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
