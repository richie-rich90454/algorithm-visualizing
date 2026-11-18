/**
 * fixed-point-iteration.test.ts - Reference-iteration check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./fixed-point-iteration";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent iteration used as a reference for the final estimate. */
function reference(fn: string, x0: number, a: number, b: number, tol: number, cap: number): number {
    const g = (x: number) => {
        if (fn === "sqrt") return (x + a / x) / 2;
        if (fn === "linear") return a * x + b;
        if (fn === "exp-neg") return Math.exp(-x);
        return Math.cos(x);
    };
    let x = x0;
    for (let n = 0; n < cap; n += 1) {
        const next = g(x);
        if (Math.abs(next - x) < tol) return next;
        x = next;
    }
    return x;
}

describe("Fixed-Point Iteration", () => {
    it("converges to the known fixed point of cosine", () => {
        const frames = [...mod.run({ fn: "cos", x0: 1, tolerance: 1e-12, maxIterations: 100 })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        expect(meta["converged"]).toBe(true);
        expect(Number(meta["estimate"])).toBeCloseTo(0.7390851332, 8);
        expect(Number(meta["residual"])).toBeLessThan(1e-10);
    });

    it("matches an independent reference across function types", () => {
        const cases: Array<{ fn: string; x0: number; a: number; b: number }> = [
            { fn: "cos", x0: 0.5, a: 0, b: 0 },
            { fn: "sqrt", x0: 2, a: 7, b: 0 },
            { fn: "exp-neg", x0: 1, a: 0, b: 0 },
            { fn: "linear", x0: 1, a: 0.5, b: 0.25 },
        ];
        for (const c of cases) {
            const tol = 1e-12;
            const frames = [...mod.run({ ...c, tolerance: tol, maxIterations: 120 })];
            checkFrames(frames);
            const estimate = Number(frames[frames.length - 1]!.meta["estimate"]);
            expect(estimate).toBeCloseTo(reference(c.fn, c.x0, c.a, c.b, tol, 120), 9);
        }
    });

    it("computes square roots by the Babylonian fixed point", () => {
        for (const a of [2, 7, 25, 0.5]) {
            const frames = [...mod.run({ fn: "sqrt", x0: a > 1 ? a : 1, a, tolerance: 1e-14 })];
            expect(Number(frames[frames.length - 1]!.meta["estimate"])).toBeCloseTo(Math.sqrt(a), 10);
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
