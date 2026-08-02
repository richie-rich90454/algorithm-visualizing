/**
 * dijkstra-matrix.test.ts – Minimum viable test for Dijkstra (Matrix).
 */

import { describe, expect, it } from "vitest";
import dijkstraMatrix from "./dijkstra-matrix";

describe("DijkstraMatrix", () => {
    it("yields at least one frame", () => {
        const generator = dijkstraMatrix.run(dijkstraMatrix.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = dijkstraMatrix.run(dijkstraMatrix.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
