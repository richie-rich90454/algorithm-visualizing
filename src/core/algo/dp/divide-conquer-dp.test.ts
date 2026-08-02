/**
 * divide-conquer-dp.test.ts – Minimum viable test for Divide & Conquer DP.
 */

import { describe, expect, it } from "vitest";
import divideConquerDp from "./divide-conquer-dp";

describe("DivideConquerDp", () => {
    it("yields at least one frame", () => {
        const generator = divideConquerDp.run(divideConquerDp.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = divideConquerDp.run(divideConquerDp.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
