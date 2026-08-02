/**
 * binary-exponentiation.test.ts – Minimum viable test for Binary Exponentiation.
 */

import { describe, expect, it } from "vitest";
import binaryExponentiation from "./binary-exponentiation";

describe("BinaryExponentiation", () => {
    it("yields at least one frame", () => {
        const generator = binaryExponentiation.run(binaryExponentiation.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = binaryExponentiation.run(binaryExponentiation.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
