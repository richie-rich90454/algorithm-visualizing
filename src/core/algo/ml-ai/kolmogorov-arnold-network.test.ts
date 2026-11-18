/**
 * kolmogorov-arnold-network.test.ts - Spline interpolation correctness, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./kolmogorov-arnold-network";
import type { VisualFrame } from "@/types";

/** Independent piecewise-linear interpolation using explicit segment search. */
function reference(knots: number[], row: number[], x: number): number {
    const clamped = Math.min(knots[knots.length - 1] ?? 1, Math.max(knots[0] ?? 0, x));
    for (let j = knots.length - 1; j >= 0; j -= 1) {
        const left = knots[j] ?? 0;
        if (clamped >= left) {
            const right = knots[j + 1] ?? left + 1;
            const t = (clamped - left) / (right - left);
            return (row[j] ?? 0) + t * ((row[j + 1] ?? 0) - (row[j] ?? 0));
        }
    }
    return row[0] ?? 0;
}

function checkFrames(frames: VisualFrame[], knots: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(knots + 1);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.entities.every((e) => Number.isFinite(e.x) && Number.isFinite(e.y))).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("KAN spline core", () => {
    it("sums edge splines to the reference layer output", () => {
        const input = mod.defaultInput as { knots: number[]; values: number[][]; x: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.knots.length);
        let expected = 0;
        for (let i = 0; i < Math.min(input.values.length, input.x.length); i += 1) {
            expected += reference(input.knots, input.values[i] ?? [], input.x[i] ?? 0);
        }
        const output = frames[frames.length - 1]?.meta["output"];
        expect(output).toBeCloseTo(expected, 9);
    });

    it("interpolates exactly at every knot", () => {
        const knots = [0, 0.25, 0.5, 1];
        const values = [[0, 3, 1, 4]];
        for (const query of knots) {
            const frames = [...mod.run({ knots, values, x: [query] })];
            const phi = frames[frames.length - 2]?.meta["phi"];
            expect(phi).toBeCloseTo(reference(knots, values[0] ?? [], query), 9);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
