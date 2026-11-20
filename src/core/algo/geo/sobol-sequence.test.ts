/** sobol-sequence.test.ts - Radical-inverse reference, uniformity properties, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./sobol-sequence";
import type { VisualFrame } from "@/types";

/** Independent base-two radical inverse (first Sobol dimension). */
function radicalInverse2(index: number): number {
    let result = 0;
    let denominator = 0.5;
    let i = index;
    while (i > 0) {
        if ((i & 1) === 1) result += denominator;
        denominator /= 2;
        i = Math.floor(i / 2);
    }
    return result;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Sobol Sequence", () => {
    it("matches the base-two radical inverse in the first dimension", () => {
        const input = mod.defaultInput as { count: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const xs = frames[frames.length - 1]?.meta["xs"] as number[];
        const ys = frames[frames.length - 1]?.meta["ys"] as number[];
        expect(xs).toHaveLength(input.count);
        expect(xs[0]).toBe(0);
        expect(ys[0]).toBe(0);
        xs.forEach((x, i) => {
            expect(x).toBeCloseTo(radicalInverse2(i), 10);
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThan(1);
            expect(ys[i]).toBeGreaterThanOrEqual(0);
            expect(ys[i]).toBeLessThan(1);
        });
    });

    it("produces unique points and splits the square evenly", () => {
        const frames = [...mod.run({ count: 64 })];
        const xs = frames[frames.length - 1]?.meta["xs"] as number[];
        const ys = frames[frames.length - 1]?.meta["ys"] as number[];
        const unique = new Set(xs.map((x, i) => `${x},${ys[i]}`));
        expect(unique.size).toBe(64);
        const quadrants = [0, 0, 0, 0];
        for (let i = 0; i < xs.length; i += 1) {
            quadrants[(xs[i] < 0.5 ? 0 : 1) + ((ys[i] as number) < 0.5 ? 0 : 2)] += 1;
        }
        expect(Math.max(...quadrants) - Math.min(...quadrants)).toBeLessThanOrEqual(2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
