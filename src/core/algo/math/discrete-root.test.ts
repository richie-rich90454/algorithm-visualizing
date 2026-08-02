/**
 * discrete-root.test.ts – Minimum viable test for Discrete Root.
 */

import { describe, expect, it } from "vitest";
import discreteRoot from "./discrete-root";

describe("DiscreteRoot", () => {
    it("yields at least one frame", () => {
        const generator = discreteRoot.run(discreteRoot.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = discreteRoot.run(discreteRoot.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
