/**
 * euler-totient.test.ts – Minimum viable test for Euler's Totient.
 */

import { describe, expect, it } from "vitest";
import eulerTotient from "./euler-totient";

describe("EulerTotient", () => {
    it("yields at least one frame", () => {
        const generator = eulerTotient.run(eulerTotient.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = eulerTotient.run(eulerTotient.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
