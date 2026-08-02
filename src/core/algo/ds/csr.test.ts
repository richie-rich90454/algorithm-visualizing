/**
 * csr.test.ts – Minimum viable test for CSR.
 */

import { describe, expect, it } from "vitest";
import csr from "./csr";

describe("Csr", () => {
    it("yields at least one frame", () => {
        const generator = csr.run(csr.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = csr.run(csr.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
