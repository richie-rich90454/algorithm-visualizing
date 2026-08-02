/**
 * boyer-moore.test.ts – Minimum viable test for Boyer-Moore.
 */

import { describe, expect, it } from "vitest";
import boyerMoore from "./boyer-moore";

describe("BoyerMoore", () => {
    it("yields at least one frame", () => {
        const generator = boyerMoore.run(boyerMoore.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = boyerMoore.run(boyerMoore.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
