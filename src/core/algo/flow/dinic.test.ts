/**
 * dinic.test.ts – Minimum viable test for Dinic's Algorithm.
 */

import { describe, expect, it } from "vitest";
import dinic from "./dinic";

describe("Dinic", () => {
    it("yields at least one frame", () => {
        const generator = dinic.run(dinic.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = dinic.run(dinic.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
