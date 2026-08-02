/**
 * interval-matrix-chain.test.ts – Minimum viable test for Matrix Chain.
 */

import { describe, expect, it } from "vitest";
import intervalMatrixChain from "./interval-matrix-chain";

describe("IntervalMatrixChain", () => {
    it("yields at least one frame", () => {
        const generator = intervalMatrixChain.run(intervalMatrixChain.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = intervalMatrixChain.run(intervalMatrixChain.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
