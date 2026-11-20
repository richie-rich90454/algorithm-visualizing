/**
 * wilson-confidence-interval.test.ts - Brute-force score-equation root finding,
 * boundary properties, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./wilson-confidence-interval";
import type { VisualFrame } from "@/types";

/** Solve |phat - p| = z * sqrt(p(1-p)/n) on [lo, hi] by bisection. */
function scoreRoot(phat: number, z: number, n: number, lo: number, hi: number): number {
    const sign = lo < phat ? 1 : -1;
    const f = (p: number): number => sign * (phat - p) - z * Math.sqrt((p * (1 - p)) / n);
    if (Math.abs(f(lo)) < 1e-12) return lo;
    if (Math.abs(f(hi)) < 1e-12) return hi;
    let a = lo;
    let b = hi;
    for (let i = 0; i < 100; i += 1) {
        const mid = (a + b) / 2;
        if (f(a) * f(mid) <= 0) {
            b = mid;
        } else {
            a = mid;
        }
    }
    return (a + b) / 2;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Wilson Score Confidence Interval", () => {
    it("matches brute-force roots of the score equation", () => {
        const cases = [
            { successes: 45, trials: 100 },
            { successes: 3, trials: 20 },
            { successes: 97, trials: 100 },
            { successes: 0, trials: 15 },
            { successes: 15, trials: 15 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ ...testCase, confidence: 0.95 })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const phat = testCase.successes / testCase.trials;
            expect(Number(meta?.["z"])).toBeCloseTo(1.959963984540054, 5);
            const z = Number(meta?.["z"]);
            if (testCase.successes === 0 || testCase.successes === testCase.trials) {
                // At the boundaries the score equation has a trivial root at the
                // estimate itself, so check the known closed-form endpoints.
                const z2 = z * z;
                const n = testCase.trials;
                if (testCase.successes === 0) {
                    expect(Number(meta?.["lower"])).toBe(0);
                    expect(Number(meta?.["upper"])).toBeCloseTo(z2 / (n + z2), 8);
                } else {
                    expect(Number(meta?.["lower"])).toBeCloseTo(n / (n + z2), 8);
                    expect(Number(meta?.["upper"])).toBeCloseTo(1, 12);
                }
            } else {
                const lower = scoreRoot(phat, z, testCase.trials, 0, phat);
                const upper = scoreRoot(phat, z, testCase.trials, phat, 1);
                expect(Number(meta?.["lower"])).toBeCloseTo(lower, 8);
                expect(Number(meta?.["upper"])).toBeCloseTo(upper, 8);
            }
        }
    });

    it("stays in range, contains the estimate, and narrows with more data", () => {
        const small = [...mod.run({ successes: 25, trials: 50 })];
        const large = [...mod.run({ successes: 250, trials: 500 })];
        const a = small[small.length - 1]?.meta;
        const b = large[large.length - 1]?.meta;
        expect(Number(a?.["lower"])).toBeGreaterThanOrEqual(0);
        expect(Number(a?.["upper"])).toBeLessThanOrEqual(1);
        expect(Number(a?.["lower"])).toBeLessThanOrEqual(0.5);
        expect(Number(a?.["upper"])).toBeGreaterThanOrEqual(0.5);
        const widthA = Number(a?.["upper"]) - Number(a?.["lower"]);
        const widthB = Number(b?.["upper"]) - Number(b?.["lower"]);
        expect(widthB).toBeLessThan(widthA);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});
