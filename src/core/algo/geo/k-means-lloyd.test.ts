/**
 * k-means-lloyd.test.ts – Minimum viable test.
 */
import { describe, expect, it } from "vitest";
import kmeans from "./k-means-lloyd";

describe("KMeansLloyd", () => {
    it("yields at least one frame", () => {
        const generator = kmeans.run(kmeans.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = kmeans.run(kmeans.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
