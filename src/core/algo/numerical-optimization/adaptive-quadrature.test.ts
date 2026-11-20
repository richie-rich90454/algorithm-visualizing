/**
 * adaptive-quadrature.test.ts - Independent adaptive Simpson reference, exactness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./adaptive-quadrature";
import type { VisualFrame } from "@/types";

const FNS: Record<string, (x: number) => number> = {
    x2: (x) => x * x,
    x3: (x) => x * x * x,
    sin: Math.sin,
    cos: Math.cos,
};
const EXACT: Record<string, (a: number, b: number) => number> = {
    x2: (a, b) => (b ** 3 - a ** 3) / 3,
    x3: (a, b) => (b ** 4 - a ** 4) / 4,
    sin: (a, b) => Math.cos(a) - Math.cos(b),
    cos: (a, b) => Math.sin(b) - Math.sin(a),
};

function simpson(f: (x: number) => number, lo: number, hi: number): number {
    const mid = (lo + hi) / 2;
    return ((hi - lo) / 6) * (f(lo) + 4 * f(mid) + f(hi));
}

/** Independent recursive adaptive Simpson reference. */
function reference(fn: string, a: number, b: number, tol: number, maxDepth: number): number {
    const f = FNS[fn]!;
    const recur = (lo: number, hi: number, whole: number, localTol: number, depth: number): number => {
        const mid = (lo + hi) / 2;
        const left = simpson(f, lo, mid);
        const right = simpson(f, mid, hi);
        const error = Math.abs(left + right - whole) / 15;
        if (error <= localTol || depth >= maxDepth) {
            return left + right + (left + right - whole) / 15;
        }
        return recur(lo, mid, left, localTol / 2, depth + 1) + recur(mid, hi, right, localTol / 2, depth + 1);
    };
    return recur(a, b, simpson(f, a, b), tol, 0);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["cols"]).toBe(5);
        expect(frame.entities.length).toBe((frame.meta["rows"] as number) * 5);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("AdaptiveQuadrature", () => {
    it("matches an independent adaptive Simpson reference", () => {
        const cases: Array<{ fn: string; a: number; b: number; tol: number }> = [
            { fn: "sin", a: 0, b: 1, tol: 1e-6 },
            { fn: "cos", a: -1, b: 2, tol: 1e-8 },
            { fn: "x2", a: 0, b: 3, tol: 1e-5 },
            { fn: "x3", a: -2, b: 2, tol: 1e-7 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(testCase.fn, testCase.a, testCase.b, testCase.tol, 20);
            expect(final?.["estimate"] as number).toBeCloseTo(expected, 10);
            expect(final?.["exact"] as number).toBeCloseTo(EXACT[testCase.fn]!(testCase.a, testCase.b), 10);
            expect(final?.["done"]).toBe(true);
        }
    });

    it("is exact for polynomials up to degree three and meets the tolerance", () => {
        for (const fn of ["x2", "x3", "sin", "cos"]) {
            const frames = [...mod.run({ fn, a: 0, b: 1, tol: 1e-10, maxDepth: 20 })];
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["error"] as number).toBeLessThan(1e-8);
        }
        const coarse = [...mod.run({ fn: "sin", a: 0, b: 1, tol: 1e-3 })].pop()?.meta["error"] as number;
        const fine = [...mod.run({ fn: "sin", a: 0, b: 1, tol: 1e-9 })].pop()?.meta["error"] as number;
        expect(fine).toBeLessThan(coarse);
    });

    it("subdivides more when the tolerance is tighter", () => {
        const coarse = [...mod.run({ fn: "sin", a: 0, b: 1, tol: 1e-3 })].pop()?.meta["rows"] as number;
        const fine = [...mod.run({ fn: "sin", a: 0, b: 1, tol: 1e-9 })].pop()?.meta["rows"] as number;
        expect(fine).toBeGreaterThanOrEqual(coarse);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
