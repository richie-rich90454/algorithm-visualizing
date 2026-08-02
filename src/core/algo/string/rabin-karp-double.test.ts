/**
 * rabin-karp-double.test.ts – Minimum viable test for Rabin-Karp (Double).
 */

import { describe, expect, it } from "vitest";
import rabinKarpDouble from "./rabin-karp-double";

describe("RabinKarpDouble", () => {
    it("yields at least one frame", () => {
        const generator = rabinKarpDouble.run(rabinKarpDouble.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = rabinKarpDouble.run(rabinKarpDouble.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
