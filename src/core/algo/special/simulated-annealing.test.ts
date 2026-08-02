/**
 * simulated-annealing.test.ts – Minimum viable test for Simulated Annealing.
 */

import { describe, expect, it } from "vitest";
import simulatedAnnealing from "./simulated-annealing";

describe("SimulatedAnnealing", () => {
    it("yields at least one frame", () => {
        const generator = simulatedAnnealing.run(simulatedAnnealing.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = simulatedAnnealing.run(simulatedAnnealing.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
