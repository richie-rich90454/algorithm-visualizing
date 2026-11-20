/**
 * quantum-linear-regression.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./quantum-linear-regression";
import type { VisualFrame } from "@/types";

/** Independent closed-form least-squares fit for a two-column design matrix. */
function closedForm(x: number[], y: number[]): [number, number] {
    const n = x.length;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (let i = 0; i < n; i += 1) {
        sx += x[i] as number;
        sy += y[i] as number;
        sxx += (x[i] as number) * (x[i] as number);
        sxy += (x[i] as number) * (y[i] as number);
    }
    const determinant = n * sxx - sx * sx;
    const slope = (n * sxy - sx * sy) / determinant;
    const intercept = (sy - slope * sx) / n;
    return [intercept, slope];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Quantum Linear Regression", () => {
    it("recovers the exact fitted line for a perfect linear data set", () => {
        const input = mod.defaultInput as { x: number[]; y: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["done"]).toBe(true);
        const weights = last?.["weights"] as number[];
        const expected = closedForm(input.x, input.y);
        expect(weights[0]).toBeCloseTo(expected[0], 8);
        expect(weights[1]).toBeCloseTo(expected[1], 8);
        expect(weights[0]).toBeCloseTo(1, 8);
        expect(weights[1]).toBeCloseTo(2, 8);
        expect(last?.["residual"] as number).toBeLessThan(1e-12);
    });

    it("matches closed-form least squares on noisy data", () => {
        const input = { x: [-2, -1, 0, 1, 3], y: [-3.1, -0.9, 0.2, 2.1, 5.8] };
        const frames = [...mod.run(input)];
        const weights = frames[frames.length - 1]?.meta["weights"] as number[];
        const expected = closedForm(input.x, input.y);
        expect(weights[0]).toBeCloseTo(expected[0], 8);
        expect(weights[1]).toBeCloseTo(expected[1], 8);
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
