/**
 * markov-inequality.test.ts - Bound validity, brute-force agreement, frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./markov-inequality";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 4);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["family"]).toBe("markov");
    });
}

describe("Markov Inequality", () => {
    it("keeps the bound valid and matches an independent computation", () => {
        const input = { samples: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], thresholds: [2, 4, 6, 8, 10, 12] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.thresholds.length);
        const meta = frames[frames.length - 1]?.meta;
        const mean = input.samples.reduce((a, b) => a + b, 0) / input.samples.length;
        expect(meta?.["mean"]).toBeCloseTo(mean, 5);
        expect(meta?.["valid"]).toBe(true);
        const tails = meta?.["tails"] as number[];
        const bounds = meta?.["bounds"] as number[];
        input.thresholds.forEach((a, i) => {
            const tail = input.samples.filter((v) => v >= a).length / input.samples.length;
            expect(tails[i]).toBeCloseTo(tail, 5);
            expect(bounds[i]).toBeCloseTo(mean / a, 5);
            expect(tail).toBeLessThanOrEqual(Math.min(1, mean / a) + 1e-12);
        });
    });

    it("never violates the bound on skewed data", () => {
        const samples = [0, 0, 0, 0, 0, 0, 0, 100];
        const frames = [...mod.run({ samples, thresholds: [1, 5, 20, 50, 100, 200] })];
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["valid"]).toBe(true);
        expect(meta?.["holds"]).toEqual([1, 1, 1, 1, 1, 1]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
