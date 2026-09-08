/**
 * christofides-euclidean-tsp.test.ts – Minimum viable test for Christofides Euclidean TSP.
 */
import { describe, expect, it } from "vitest";
import mod from "./christofides-euclidean-tsp";

describe("ChristofidesTsp", () => {
    it("yields at least one frame", () => {
        const generator = mod.run(mod.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
