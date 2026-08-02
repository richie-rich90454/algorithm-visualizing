/**
 * duval-lyndon.test.ts – Minimum viable test for Duval's algorithm.
 */

import { describe, expect, it } from "vitest";
import duvalLyndon from "./duval-lyndon";

describe("DuvalLyndon", () => {
    it("yields at least one frame", () => {
        const generator = duvalLyndon.run(duvalLyndon.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = duvalLyndon.run(duvalLyndon.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
