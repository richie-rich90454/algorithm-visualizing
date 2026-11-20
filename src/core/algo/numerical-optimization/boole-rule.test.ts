/**
 * boole-rule.test.ts - Independent quadrature reference, exactness properties, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./boole-rule";
import type { VisualFrame } from "@/types";

const FNS: Record<string, (x: number) => number> = {
    x2: (x) => x * x,
    x4: (x) => x ** 4,
    x5: (x) => x ** 5,
    sin: Math.sin,
    cos: Math.cos,
    linear: (x) => 2 * x + 1,
};
const EXACT: Record<string, (a: number, b: number) => number> = {
    x2: (a, b) => (b ** 3 - a ** 3) / 3,
    x4: (a, b) => (b ** 5 - a ** 5) / 5,
    x5: (a, b) => (b ** 6 - a ** 6) / 6,
    sin: (a, b) => Math.cos(a) - Math.cos(b),
    cos: (a, b) => Math.sin(b) - Math.sin(a),
    linear: (a, b) => b * b + b - (a * a + a),
};

function reference(a: number, b: number, n: number, fn: string): number {
    const h = (b - a) / n;
    let sum = 0;
    for (let i = 0; i <= n; i += 1) {
        const w = i === 0 || i === n ? 7 : i % 4 === 0 ? 14 : i % 4 === 2 ? 12 : 32;
        sum += w * FNS[fn]!(a + i * h);
    }
    return ((2 * h) / 45) * sum;
}

function normalize(a: number, b: number, requested: number) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const panels = Math.max(1, Math.min(50, Math.ceil(requested / 4)));
    return { a: lo, b: hi, n: panels * 4, panels };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["rows"]).toBe(n + 1);
        expect(frame.meta["cols"]).toBe(5);
        expect(frame.entities.length).toBe((n + 1) * 5);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const weights = frame.meta["weights"] as number[];
        expect(weights.length).toBe(n + 1);
        weights.forEach((w, i) => {
            expect(w).toBe(i === 0 || i === n ? 7 : i % 4 === 0 ? 14 : i % 4 === 2 ? 12 : 32);
        });
    });
}

describe("BooleRule", () => {
    it("matches an independent composite Boole sum", () => {
        const cases: Array<{ a: number; b: number; n: number; fn: string }> = [
            { a: 0, b: 1, n: 8, fn: "x2" },
            { a: 2, b: 5, n: 12, fn: "x4" },
            { a: -1, b: 1, n: 4, fn: "x5" },
            { a: -1, b: 1, n: 16, fn: "sin" },
            { a: 0, b: 1.2, n: 20, fn: "cos" },
            { a: 4, b: -2, n: 7, fn: "linear" },
        ];
        for (const testCase of cases) {
            const { a, b, n } = normalize(testCase.a, testCase.b, testCase.n);
            const frames = [...mod.run(testCase)];
            checkFrames(frames, n);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["approximation"] as number).toBeCloseTo(reference(a, b, n, testCase.fn), 11);
            expect(final?.["a"]).toBe(a);
            expect(final?.["b"]).toBe(b);
            expect(final?.["n"]).toBe(n);
            expect(final?.["exact"] as number).toBeCloseTo(EXACT[testCase.fn]!(a, b), 12);
        }
    });

    it("is exact for polynomials through degree five", () => {
        for (const fn of ["linear", "x2", "x4", "x5"]) {
            for (const [a, b] of [
                [0, 1],
                [-3, 4],
                [2, 2.5],
            ]) {
                const frames = [...mod.run({ a, b, n: 4, fn })];
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["error"] as number).toBeLessThan(1e-9);
            }
        }
    });

    it("improves on smooth functions as panels increase", () => {
        const coarse = [...mod.run({ a: 0, b: 1, n: 4, fn: "sin" })].pop()?.meta["error"] as number;
        const fine = [...mod.run({ a: 0, b: 1, n: 16, fn: "sin" })].pop()?.meta["error"] as number;
        expect(fine).toBeLessThan(coarse);
        expect(fine).toBeLessThan(1e-9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(11);
        expect(generator.next().done).toBe(true);
    });
});
