/**
 * convex-layers-onion-peeling.test.ts – Minimum viable test.
 */
import { describe, expect, it } from "vitest";
import layers from "./convex-layers-onion-peeling";

describe("ConvexLayersOnionPeeling", () => {
    it("yields at least one frame", () => {
        const generator = layers.run(layers.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = layers.run(layers.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
