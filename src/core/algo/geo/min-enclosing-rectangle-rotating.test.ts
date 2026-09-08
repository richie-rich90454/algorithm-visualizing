/**
 * min-enclosing-rectangle-rotating.test.ts – Minimum viable test.
 */
import { describe, expect, it } from "vitest";
import rect from "./min-enclosing-rectangle-rotating";

describe("MinEnclosingRectangleRotating", () => {
    it("yields at least one frame", () => {
        const generator = rect.run(rect.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = rect.run(rect.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
