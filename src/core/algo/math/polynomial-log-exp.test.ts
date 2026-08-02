/**
 * polynomial-log-exp.test.ts – Minimum viable test for Polynomial Log/Exp.
 */

import { describe, expect, it } from "vitest";
import polynomialLogExp from "./polynomial-log-exp";

describe("PolynomialLogExp", () => {
    it("yields at least one frame", () => {
        const generator = polynomialLogExp.run(polynomialLogExp.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = polynomialLogExp.run(polynomialLogExp.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
