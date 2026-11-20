/**
 * dagum-distribution.test.ts - Algebraic cross-check, numeric integration, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./dagum-distribution";
import type { VisualFrame } from "@/types";

/** Density derived through the inverse-ratio form of the Dagum CDF. */
function referencePdf(x: number, a: number, b: number, p: number): number {
    if (x <= 0) return 0;
    const inv = Math.pow(x / b, -a);
    return ((a * p) / b) * Math.pow(x / b, -a - 1) * Math.pow(1 + inv, -p - 1);
}

/** Composite Simpson integral of a function over [0, end]. */
function integrate(fn: (x: number) => number, end: number, panels: number): number {
    const h = end / panels;
    let sum = fn(0) + fn(end);
    for (let i = 1; i < panels; i += 1) sum += (i % 2 === 0 ? 2 : 4) * fn(i * h);
    return (sum * h) / 3;
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

describe("Dagum Type I Distribution", () => {
    it("matches the inverse-ratio density form and its integrated cumulative", () => {
        const a = 2;
        const b = 1;
        const p = 3;
        const frames = [...mod.run({ a, b, p, points: 200 })];
        checkFrames(frames, 200);
        const final = frames[frames.length - 1];
        const xs = final?.meta["xs"] as number[];
        const pdf = final?.meta["pdf"] as number[];
        const cdf = final?.meta["cdf"] as number[];
        pdf.forEach((value, i) => {
            expect(value).toBeCloseTo(referencePdf(xs[i] as number, a, b, p), 9);
        });
        for (const i of [20, 60, 100, 160, 200]) {
            const end = xs[i] as number;
            const panels = Math.max(4000, Math.round(end * 50));
            const expected = integrate((x) => referencePdf(x, a, b, p), end, panels);
            expect(cdf[i] as number).toBeCloseTo(expected, 3);
        }
        expect(cdf[0]).toBe(0);
        expect(cdf[200] as number).toBeCloseTo(1, 3);
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] as number);
        }
    });

    it("returns quantiles whose integrated density matches the target probability", () => {
        const a = 3;
        const b = 2;
        const p = 1.5;
        const frames = [...mod.run({ a, b, p, points: 50 })];
        const final = frames[frames.length - 1];
        const quantiles = final?.meta["quantiles"] as number[];
        const targets = [0.1, 0.5, 0.9];
        quantiles.forEach((q, i) => {
            expect(integrate((x) => referencePdf(x, a, b, p), q, 4000)).toBeCloseTo(targets[i] as number, 3);
        });
        expect(quantiles[0] as number).toBeLessThan(quantiles[1] as number);
        expect(quantiles[1] as number).toBeLessThan(quantiles[2] as number);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
