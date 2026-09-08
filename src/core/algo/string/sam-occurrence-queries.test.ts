/**
 * sam-occurrence-queries.test.ts – Minimum viable test.
 */

import { describe, expect, it } from "vitest";
import mod from "./sam-occurrence-queries";

describe("SAM Occurrences", () => {
    it("yields at least one frame", () => {
        const g = mod.run(mod.defaultInput);
        const f = g.next();
        expect(f.done).toBe(false);
        expect(Array.isArray((f.value as unknown as { entities: unknown }).entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const g = mod.run(mod.defaultInput);
        let n = 0;
        for (const fr of g) {
            expect(fr.entities.length).toBeGreaterThan(0);
            n += 1;
        }
        expect(n).toBeGreaterThan(0);
    });
});
