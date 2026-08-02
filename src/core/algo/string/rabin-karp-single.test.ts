/**
 * rabin-karp-single.test.ts – Minimum viable test for Rabin-Karp (Single).
 */

import { describe, expect, it } from "vitest";
import rabinKarpSingle from "./rabin-karp-single";

describe("RabinKarpSingle", () => {
    it("yields at least one frame", () => {
        const generator = rabinKarpSingle.run(rabinKarpSingle.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = rabinKarpSingle.run(rabinKarpSingle.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
