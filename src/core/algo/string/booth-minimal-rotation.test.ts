/**
 * booth-minimal-rotation.test.ts – Minimum viable test for Booth's algorithm.
 */

import { describe, expect, it } from "vitest";
import boothMinimalRotation from "./booth-minimal-rotation";

describe("BoothMinimalRotation", () => {
    it("yields at least one frame", () => {
        const generator = boothMinimalRotation.run(boothMinimalRotation.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = boothMinimalRotation.run(boothMinimalRotation.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });
});
