/**
 * simpsons-rule.test.ts - Independent quadrature reference, exactness properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./simpsons-rule";
import type { VisualFrame } from "@/types";

const FNS: Record<string, (x: number) => number> = {
    x2: (x) => x * x,
    x3: (x) => x * x * x,
    sin: Math.sin,
    cos: Math.cos,
    linear: (x) => 2 * x + 1,
};
const EXACT: Record<string, (a: number, b: number) => number> = {
    x2: (a, b) => (b * b * b - a * a * a) / 3,
    x3: (a, b) => (b ** 4 - a ** 4) / 4,
    sin: (a, b) => Math.cos(a) - Math.cos(b),
    cos: (a, b) => Math.sin(b) - Math.sin(a),
    linear: (a, b) => b * b + b - (a * a + a),
};

function reference(a: number, b: number, n: number, fn: string): number {
    const h = (b - a) / n;
    let sum = FNS[fn]!(a) + FNS[fn]!(b);
    for (let i = 1; i < n; i += 1) {
        sum += (i % 2 === 1 ? 4 : 2) * FNS[fn]!(a + i * h);
    }
    return (h / 3) * sum;
}

function normalize(a: number, b: number, requestedN: number) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const n = Math.max(2, Math.min(100, requestedN % 2 === 0 ? requestedN : requestedN + 1));
    return { a: lo, b: hi, n };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["rows"]).toBe(n + 1);
        expect(frame.meta["cols"]).toBe(5);
        expect(frame.entities.length).toBe((n + 1) * 5);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const weights = frame.meta["weights"] as number[];
        expect(weights.length).toBe(n + 1);
        weights.forEach((weight, i) => {
            expect(weight).toBe(i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2);
        });
    });
}

describe("SimpsonsRule", () => {
    it("matches an independent composite Simpson sum", () => {
        const cases: Array<{ a: number; b: number; n: number; fn: string }> = [
            { a: 0, b: 1, n: 8, fn: "x2" },
            { a: 2, b: 5, n: 10, fn: "x3" },
            { a: -1, b: 1, n: 6, fn: "sin" },
            { a: 0, b: 1.2, n: 12, fn: "cos" },
            { a: 4, b: -2, n: 7, fn: "linear" },
        ];
        for (const testCase of cases) {
            const { a, b, n } = normalize(testCase.a, testCase.b, testCase.n);
            const frames = [...mod.run(testCase)];
            checkFrames(frames, n);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["approximation"] as number).toBeCloseTo(reference(a, b, n, testCase.fn), 12);
            expect(final?.["a"]).toBe(a);
            expect(final?.["b"]).toBe(b);
            expect(final?.["n"]).toBe(n);
            expect(final?.["exact"] as number).toBeCloseTo(EXACT[testCase.fn]!(a, b), 12);
        }
    });

    it("is exact for polynomials up to degree three", () => {
        for (const fn of ["x2", "x3", "linear"]) {
            for (const [a, b] of [
                [0, 1],
                [-3, 4],
                [2, 2.5],
            ]) {
                const frames = [...mod.run({ a, b, n: 8, fn })];
                const final = frames[frames.length - 1]?.meta;
                expect(Math.abs((final?.["approximation"] as number) - EXACT[fn]!(a, b))).toBeLessThan(1e-10);
                expect(final?.["error"] as number).toBeLessThan(1e-10);
            }
        }
    });

    it("approximates sine and cosine well and improves with more samples", () => {
        const coarse = [...mod.run({ a: 0, b: 1, n: 4, fn: "sin" })].pop()?.meta["error"] as number;
        const fine = [...mod.run({ a: 0, b: 1, n: 16, fn: "sin" })].pop()?.meta["error"] as number;
        expect(fine).toBeLessThan(coarse);
        expect(fine).toBeLessThan(1e-6);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(11);
        expect(generator.next().done).toBe(true);
    });
});
