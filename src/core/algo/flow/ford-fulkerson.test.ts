/**
 * ford-fulkerson.test.ts – Minimum viable test for Ford-Fulkerson.
 */

import { describe, expect, it } from "vitest";
import fordFulkerson from "./ford-fulkerson";

describe("FordFulkerson", () => {
    it("yields at least one frame", () => {
        const generator = fordFulkerson.run(fordFulkerson.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = fordFulkerson.run(fordFulkerson.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
