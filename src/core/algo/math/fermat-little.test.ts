/**
 * fermat-little.test.ts – Minimum viable test for Fermat's Little Theorem.
 */

import { describe, expect, it } from "vitest";
import fermatLittle from "./fermat-little";

describe("FermatLittle", () => {
    it("yields at least one frame", () => {
        const generator = fermatLittle.run(fermatLittle.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = fermatLittle.run(fermatLittle.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
