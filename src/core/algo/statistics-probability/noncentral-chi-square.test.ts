/**
 * noncentral-chi-square.test.ts - Central-limit cross-check, mixture properties, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./noncentral-chi-square";
import type { VisualFrame } from "@/types";

/** Independent closed-form central chi-square cumulative for even degrees of freedom. */
function referenceCentral(x: number, v: number): number {
    const half = x / 2;
    let tail = 1;
    let term = 1;
    for (let j = 1; j <= v / 2 - 1; j += 1) {
        term *= half / j;
        tail += term;
    }
    return 1 - Math.exp(-half) * tail;
}

function checkFrames(frames: VisualFrame[], points: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(points + 1);
        expect(frame.entities.every((entity) => entity.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Noncentral Chi-Square Distribution", () => {
    it("reduces to closed-form central chi-square when lambda is zero", () => {
        for (const v of [2, 4, 6]) {
            const frames = [...mod.run({ v, lambda: 0, points: 120 })];
            checkFrames(frames, 120);
            const final = frames[frames.length - 1];
            const xs = final?.meta["xs"] as number[];
            const cdf = final?.meta["cdf"] as number[];
            for (let i = 1; i <= 120; i += 2) {
                expect(cdf[i] as number).toBeCloseTo(referenceCentral(xs[i] as number, v), 5);
            }
        }
    });

    it("has a monotone curve with correct endpoints, mean, and variance", () => {
        const v = 3;
        const lambda = 4;
        const frames = [...mod.run({ v, lambda, points: 200 })];
        const final = frames[frames.length - 1];
        const cdf = final?.meta["cdf"] as number[];
        expect(cdf[0]).toBe(0);
        expect(cdf[200] as number).toBeGreaterThan(0.999);
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] as number);
        }
        expect(final?.meta["mean"]).toBe(v + lambda);
        expect(final?.meta["variance"]).toBe(2 * (v + 2 * lambda));
    });

    it("places a larger noncentral curve to the right of a central one", () => {
        const medianOf = (lambda: number): number => {
            const final = [...mod.run({ v: 3, lambda, points: 400 })].at(-1);
            const xs = final?.meta["xs"] as number[];
            const cdf = final?.meta["cdf"] as number[];
            for (let i = 1; i < cdf.length; i += 1) {
                if ((cdf[i] as number) >= 0.5) {
                    const lo = cdf[i - 1] as number;
                    const hi = cdf[i] as number;
                    const f = hi > lo ? (0.5 - lo) / (hi - lo) : 0;
                    return (xs[i - 1] as number) + f * ((xs[i] as number) - (xs[i - 1] as number));
                }
            }
            return xs[xs.length - 1] as number;
        };
        expect(medianOf(10)).toBeGreaterThan(medianOf(0));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
