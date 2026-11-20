/**
 * moment-generating-function.test.ts - Closed-form Bernoulli check, derivative
 * moment check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./moment-generating-function";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBe(steps + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(steps);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("MomentGeneratingFunction", () => {
    it("matches the closed-form Bernoulli generating function", () => {
        for (const p of [0.2, 0.5, 0.6, 0.85]) {
            const input = { values: [0, 1], probabilities: [1 - p, p], tMin: -3, tMax: 3, steps: 13 };
            const frames = [...mod.run(input)];
            checkFrames(frames, 13);
            const meta = frames[frames.length - 1]?.meta;
            const ts = meta?.["ts"] as number[];
            const mgf = meta?.["mgf"] as number[];
            for (let i = 0; i < ts.length; i += 1) {
                const expected = 1 - p + p * Math.exp(ts[i]!);
                expect(mgf[i]).toBeCloseTo(expected, 9);
            }
            expect(Number(meta?.["mean"])).toBeCloseTo(p, 10);
            expect(Number(meta?.["secondMoment"])).toBeCloseTo(p, 10);
            expect(Number(meta?.["variance"])).toBeCloseTo(p * (1 - p), 10);
        }
    });

    it("has M(0) = 1 and derivatives matching the moments", () => {
        const values = [0, 1, 2, 3];
        const probabilities = [0.1, 0.2, 0.3, 0.4];
        const frames = [...mod.run({ values, probabilities, tMin: -2, tMax: 2, steps: 9 })];
        checkFrames(frames, 9);
        const meta = frames[frames.length - 1]?.meta;
        const ts = meta?.["ts"] as number[];
        const mgf = meta?.["mgf"] as number[];
        const zeroIndex = ts.findIndex((t) => Math.abs(t) < 1e-12);
        expect(mgf[zeroIndex]).toBeCloseTo(1, 10);

        const M = (t: number) => values.reduce((sum, x, i) => sum + probabilities[i]! * Math.exp(t * x), 0);
        const h = 1e-4;
        const firstDerivative = (M(h) - M(-h)) / (2 * h);
        const secondDerivative = (M(h) - 2 * M(0) + M(-h)) / (h * h);
        expect(firstDerivative).toBeCloseTo(Number(meta?.["mean"]), 6);
        expect(secondDerivative).toBeCloseTo(Number(meta?.["secondMoment"]), 5);
    });

    it("normalizes probabilities that do not sum to one", () => {
        const frames = [...mod.run({ values: [1, 2], probabilities: [1, 3], tMin: 0, tMax: 2, steps: 5 })];
        checkFrames(frames, 5);
        const meta = frames[frames.length - 1]?.meta;
        expect(Number(meta?.["mean"])).toBeCloseTo(1.75, 10);
        const mgf = meta?.["mgf"] as number[];
        expect(mgf[0]).toBeCloseTo(1, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(11);
        expect(generator.next().done).toBe(true);
    });
});
