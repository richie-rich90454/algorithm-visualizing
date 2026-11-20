/**
 * beta-distribution.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./beta-distribution";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], m: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(m * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

/** Independent high-accuracy log-gamma via the Lanczos g=7 approximation. */
const GAMMA_P = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

function gamma(z: number): number {
    if (z < 0.5) {
        return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    }
    const x = z - 1;
    let series = GAMMA_P[0]!;
    for (let i = 1; i < GAMMA_P.length; i += 1) {
        series += GAMMA_P[i]! / (x + i);
    }
    const t = x + 7.5;
    return Math.sqrt(2 * Math.PI) * t ** (x + 0.5) * Math.exp(-t) * series;
}

function logGamma(z: number): number {
    return Math.log(gamma(z));
}

function pdf(a: number, b: number, x: number): number {
    if (x <= 0 || x >= 1) {
        return 0;
    }
    const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
    return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta);
}

/** Composite Simpson integration, independent of the module's continued fraction. */
function integrate(a: number, b: number, lo: number, hi: number, n: number): number {
    const h = (hi - lo) / n;
    let sum = pdf(a, b, lo) + pdf(a, b, hi);
    for (let i = 1; i < n; i += 1) {
        const x = lo + i * h;
        sum += (i % 2 === 1 ? 4 : 2) * pdf(a, b, x);
    }
    return (h / 3) * sum;
}

describe("Beta distribution", () => {
    it("matches brute-force integration of the CDF for several parameter pairs", () => {
        const cases: Array<[number, number]> = [
            [2, 5],
            [0.5, 0.5],
            [3, 2],
            [1, 1],
            [5, 5],
        ];
        for (const [a, b] of cases) {
            const frames = [...mod.run({ a, b, points: 11 })];
            checkFrames(frames, 11);
            const metaFrame = finalMeta(frames);
            const xs = metaFrame["xs"] as number[];
            const cdfs = metaFrame["cdfs"] as number[];
            for (let i = 1; i < xs.length - 1; i += 1) {
                // Beta(0.5, 0.5) has an endpoint singularity that fools naive quadrature;
                // use its exact closed form instead. For the others, integrate the density.
                const brute = a === 0.5 && b === 0.5
                    ? (2 / Math.PI) * Math.asin(Math.sqrt(xs[i]!))
                    : integrate(a, b, 0, xs[i]!, 4000);
                expect(Math.abs(cdfs[i]! - brute)).toBeLessThan(5e-4);
            }
            expect(cdfs[0]).toBe(0);
            expect(cdfs[cdfs.length - 1]).toBe(1);
            for (let i = 1; i < cdfs.length; i += 1) {
                expect(cdfs[i]!).toBeGreaterThanOrEqual(cdfs[i - 1]!);
            }
        }
    });

    it("has a density that integrates to one and reports correct moments", () => {
        const a = 2;
        const b = 5;
        const frames = [...mod.run({ a, b, points: 21 })];
        expect(integrate(a, b, 0, 1, 4000)).toBeCloseTo(1, 3);
        const metaFrame = finalMeta(frames);
        expect(metaFrame["mean"] as number).toBeCloseTo(a / (a + b), 9);
        expect(metaFrame["variance"] as number).toBeCloseTo((a * b) / ((a + b) ** 2 * (a + b + 1)), 9);
        expect(metaFrame["mode"] as number).toBeCloseTo((a - 1) / (a + b - 2), 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
