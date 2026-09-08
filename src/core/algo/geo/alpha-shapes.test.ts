/**
 * alpha-shapes.test.ts – Minimum viable test.
 */
import { describe, expect, it } from "vitest";
import alpha from "./alpha-shapes";

describe("AlphaShapes", () => {
    it("yields at least one frame", () => {
        const generator = alpha.run(alpha.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = alpha.run(alpha.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
