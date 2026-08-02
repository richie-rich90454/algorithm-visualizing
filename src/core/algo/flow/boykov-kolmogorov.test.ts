/**
 * boykov-kolmogorov.test.ts – Minimum viable test for Boykov-Kolmogorov.
 */

import { describe, expect, it } from "vitest";
import boykovKolmogorov from "./boykov-kolmogorov";

describe("BoykovKolmogorov", () => {
    it("yields at least one frame", () => {
        const generator = boykovKolmogorov.run(boykovKolmogorov.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = boykovKolmogorov.run(boykovKolmogorov.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
