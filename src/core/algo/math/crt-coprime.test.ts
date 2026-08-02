/**
 * crt-coprime.test.ts – Minimum viable test for CRT (coprime).
 */

import { describe, expect, it } from "vitest";
import crtCoprime from "./crt-coprime";

describe("CrtCoprime", () => {
    it("yields at least one frame", () => {
        const generator = crtCoprime.run(crtCoprime.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = crtCoprime.run(crtCoprime.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
