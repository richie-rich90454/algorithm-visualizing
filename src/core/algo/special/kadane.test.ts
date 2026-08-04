/**
 * kadane.test.ts – Tests for Kadane's Algorithm.
 */

import { describe, expect, it } from "vitest";
import kadane from "./kadane";

function collectFrames(input: unknown) {
    return [...kadane.run(input)];
}

describe("Kadane", () => {
    it("yields at least one frame", () => {
        const generator = kadane.run(kadane.defaultInput);
        const first = generator.next();
        expect(first.done).toBe(false);
        expect(Array.isArray(first.value?.entities)).toBe(true);
    });

    it("finishes and the generator terminates cleanly", () => {
        const generator = kadane.run(kadane.defaultInput);
        let frames = 0;
        for (const frame of generator) {
            expect(frame.entities.length).toBeGreaterThan(0);
            frames += 1;
        }
        expect(frames).toBeGreaterThan(0);
    });

    it("handles empty array", () => {
        const frames = collectFrames({ array: [] });
        expect(frames).toHaveLength(1);
        expect(frames[0]?.entities).toHaveLength(0);
        expect(frames[0]?.meta?.bestOverall).toBe(-Infinity);
    });

    it("handles all-negative array", () => {
        const frames = collectFrames({ array: [-3, -2, -1] });
        expect(frames.length).toBeGreaterThan(1);
        // The maximum subarray should be the least negative element.
        const last = frames[frames.length - 1];
        expect(last?.meta?.bestOverall).toBe(-1);
        // Only the best element (index 2) should be marked sorted in the final frame.
        const sorted = last?.entities.filter((e) => e.state === "sorted");
        expect(sorted).toHaveLength(1);
        expect(sorted?.[0]?.label).toBe("-1");
    });

    it("handles single-element array", () => {
        const frames = collectFrames({ array: [42] });
        expect(frames.length).toBeGreaterThan(1);
        const last = frames[frames.length - 1];
        expect(last?.meta?.bestOverall).toBe(42);
        const sorted = last?.entities.filter((e) => e.state === "sorted");
        expect(sorted).toHaveLength(1);
        expect(sorted?.[0]?.label).toBe("42");
    });

    it("handles all-positive array", () => {
        const frames = collectFrames({ array: [1, 2, 3] });
        expect(frames.length).toBeGreaterThan(1);
        const last = frames[frames.length - 1];
        expect(last?.meta?.bestOverall).toBe(6);
        // All elements should be sorted in the final frame.
        const sorted = last?.entities.filter((e) => e.state === "sorted");
        expect(sorted).toHaveLength(3);
    });

    it("correctly visualises the best subarray in intermediate frames", () => {
        // For array [1, -2, 3], the best subarray is [3] at index 2.
        const frames = collectFrames({ array: [1, -2, 3] });
        expect(frames.length).toBeGreaterThan(1);
        const last = frames[frames.length - 1];
        expect(last?.meta?.bestOverall).toBe(3);
        // Only index 2 should be sorted in the final frame.
        const sorted = last?.entities.filter((e) => e.state === "sorted");
        expect(sorted).toHaveLength(1);
        expect(sorted?.[0]?.label).toBe("3");
    });

    it("default input yields correct best overall", () => {
        const frames = collectFrames(kadane.defaultInput);
        const last = frames[frames.length - 1];
        expect(last?.meta?.bestOverall).toBe(6);
    });
});