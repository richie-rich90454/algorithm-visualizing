/** beta-prime-distribution.test.ts - Numerical integration vs CDF check. */

import { describe, expect, it } from "vitest";
import mod from "./beta-prime-distribution";
import type { VisualFrame } from "@/types";

/** Simpson integration of the beta prime density from zero to upper. */
function integrate(upper: number, a: number, b: number): number {
    const panels = 20000;
    const h = upper / panels;
    const pdf = (x: number) => {
        if (x <= 0) return 0;
        return Math.exp((a - 1) * Math.log(x) - (a + b) * Math.log(1 + x))
            / Math.exp(logBeta(a, b));
    };
    let sum = pdf(0) + pdf(upper);
    for (let i = 1; i < panels; i += 1) {
        sum += (i % 2 === 0 ? 2 : 4) * pdf(i * h);
    }
    return (sum * h) / 3;
}

function logGamma(z: number): number {
    const coefficients = [
        76.18009172947146, -86.50532032941677, 24.01409824083091,
        -1.231739572450155, 0.001208650973866179, -0.000005395239384953,
    ];
    let y = z;
    let t = z + 5.5;
    t -= (z + 0.5) * Math.log(t);
    let ser = 1.000000000190015;
    for (const c of coefficients) {
        y += 1;
        ser += c / y;
    }
    return -t + Math.log((2.5066282746310005 * ser) / z);
}

function logBeta(a: number, b: number): number {
    return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges).toEqual([]);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
    });
}

describe("Beta Prime Distribution", () => {
    it("matches numerical integration of the density at several points", () => {
        for (const params of [{ a: 2, b: 3 }, { a: 3, b: 2 }, { a: 1.5, b: 2.5 }]) {
            const frames = [...mod.run({ ...params, points: 24, xMax: 6 })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            const xs = final["xs"] as number[];
            const cdfs = final["cdfs"] as number[];
            for (const index of [6, 12, 18]) {
                const x = xs[index] ?? 0;
                expect(Math.abs((cdfs[index] ?? 0) - integrate(x, params.a, params.b)))
                    .toBeLessThan(1e-4);
            }
        }
    });

    it("has a monotone CDF bounded between zero and one", () => {
        const frames = [...mod.run({ a: 2, b: 3, points: 40, xMax: 20 })];
        const final = frames[frames.length - 1]!.meta;
        const cdfs = final["cdfs"] as number[];
        expect(cdfs[0]).toBe(0);
        for (let i = 1; i < cdfs.length; i += 1) {
            expect(cdfs[i]!).toBeGreaterThanOrEqual(cdfs[i - 1]!);
        }
        expect(cdfs[cdfs.length - 1]!).toBeGreaterThan(0.95);
        expect(cdfs[cdfs.length - 1]!).toBeLessThanOrEqual(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
