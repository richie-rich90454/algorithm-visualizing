/**
 * order-statistics.test.ts - Closed-form beta cross-check, integration, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./order-statistics";
import type { VisualFrame } from "@/types";

/** Composite Simpson integral over [0, 1]. */
function integrate(fn: (x: number) => number, panels: number): number {
    const h = 1 / panels;
    let sum = fn(0) + fn(1);
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

describe("Distribution of an Order Statistic", () => {
    it("matches closed-form minimum and maximum laws for n = 4", () => {
        const minFrames = [...mod.run({ n: 4, k: 1, points: 120 })];
        checkFrames(minFrames, 120);
        const minFinal = minFrames[minFrames.length - 1];
        const minXs = minFinal?.meta["xs"] as number[];
        const minPdf = minFinal?.meta["pdf"] as number[];
        const minCdf = minFinal?.meta["cdf"] as number[];
        for (let i = 4; i <= 116; i += 4) {
            const x = minXs[i] as number;
            expect(minPdf[i] as number).toBeCloseTo(4 * Math.pow(1 - x, 3), 8);
            expect(minCdf[i] as number).toBeCloseTo(1 - Math.pow(1 - x, 4), 8);
        }

        const maxFinal = [...mod.run({ n: 4, k: 4, points: 120 })].at(-1);
        const maxXs = maxFinal?.meta["xs"] as number[];
        const maxPdf = maxFinal?.meta["pdf"] as number[];
        const maxCdf = maxFinal?.meta["cdf"] as number[];
        for (let i = 4; i <= 116; i += 4) {
            const x = maxXs[i] as number;
            expect(maxPdf[i] as number).toBeCloseTo(4 * Math.pow(x, 3), 8);
            expect(maxCdf[i] as number).toBeCloseTo(Math.pow(x, 4), 8);
        }
    });

    it("has a unit integral, monotone cumulative, and exact expectation", () => {
        const n = 7;
        const k = 3;
        const final = [...mod.run({ n, k, points: 200 })].at(-1);
        const pdf = final?.meta["pdf"] as number[];
        const cdf = final?.meta["cdf"] as number[];
        const xs = final?.meta["xs"] as number[];
        const closedPdf = (x: number) => 105 * x * x * Math.pow(1 - x, 4);
        expect(integrate(closedPdf, 20000)).toBeCloseTo(1, 10);
        expect(integrate((x) => x * closedPdf(x), 20000)).toBeCloseTo(k / (n + 1), 10);
        for (let i = 10; i < 190; i += 10) {
            expect(pdf[i] as number).toBeCloseTo(closedPdf(xs[i] as number), 8);
        }
        expect(final?.meta["expectation"]).toBeCloseTo(k / (n + 1), 12);
        expect(cdf[0]).toBe(0);
        expect(cdf[200]).toBeCloseTo(1, 8);
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] as number);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
