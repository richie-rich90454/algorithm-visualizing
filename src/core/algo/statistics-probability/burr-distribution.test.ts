/**
 * burr-distribution.test.ts - Numeric integration cross-check, quantile round trip, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./burr-distribution";
import type { VisualFrame } from "@/types";

/** Density written independently from the cumulative function shape. */
function referencePdf(x: number, c: number, k: number, s: number): number {
    if (x <= 0) return 0;
    const t = Math.pow(x / s, c);
    return ((c * k) / s) * Math.pow(x / s, c - 1) * Math.pow(1 + t, -k - 1);
}

/** Composite Simpson integral of the independent density over [0, end]. */
function integrate(reference: (x: number) => number, end: number, panels: number): number {
    if (panels % 2 !== 0) throw new Error("even panels required");
    const h = end / panels;
    let sum = reference(0) + reference(end);
    for (let i = 1; i < panels; i += 1) {
        sum += (i % 2 === 0 ? 2 : 4) * reference(i * h);
    }
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

describe("Burr Type XII Distribution", () => {
    it("has a cumulative curve equal to the numeric integral of the density", () => {
        const c = 2;
        const k = 3;
        const s = 1;
        const frames = [...mod.run({ c, k, s, points: 200 })];
        checkFrames(frames, 200);
        const final = frames[frames.length - 1];
        const xs = final?.meta["xs"] as number[];
        const pdf = final?.meta["pdf"] as number[];
        const cdf = final?.meta["cdf"] as number[];
        pdf.forEach((value, i) => {
            expect(value).toBeCloseTo(referencePdf(xs[i] as number, c, k, s), 9);
        });
        for (const i of [20, 60, 100, 160, 200]) {
            const expected = integrate((x) => referencePdf(x, c, k, s), xs[i] as number, 2000);
            expect(cdf[i] as number).toBeCloseTo(expected, 3);
        }
        expect(cdf[0]).toBe(0);
        expect(cdf[200] as number).toBeCloseTo(1, 3);
        for (let i = 1; i < cdf.length; i += 1) {
            expect(cdf[i] as number).toBeGreaterThanOrEqual(cdf[i - 1] as number);
        }
    });

    it("returns quantiles whose numeric integral matches the requested probability", () => {
        const c = 1.5;
        const k = 4;
        const s = 2;
        const frames = [...mod.run({ c, k, s, points: 50 })];
        const final = frames[frames.length - 1];
        const quantiles = final?.meta["quantiles"] as number[];
        const targets = [0.1, 0.5, 0.9];
        quantiles.forEach((q, i) => {
            const area = integrate((x) => referencePdf(x, c, k, s), q, 4000);
            expect(area).toBeCloseTo(targets[i] as number, 3);
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
