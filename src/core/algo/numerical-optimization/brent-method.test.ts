/**
 * brent-method.test.ts - Bisection reference, residual checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./brent-method";
import type { VisualFrame } from "@/types";

const F: Record<string, (x: number) => number> = {
    "x2-2": (x) => x * x - 2,
    "x3-x-2": (x) => x * x * x - x - 2,
    "cos-x": (x) => Math.cos(x) - x,
    "exp-2": (x) => Math.exp(x) - 2,
};

/** Independent bracketing reference by plain bisection. */
function bisection(f: (x: number) => number, a: number, b: number): number {
    let fa = f(a);
    let fb = f(b);
    for (let i = 0; i < 200; i += 1) {
        const mid = (a + b) / 2;
        const fm = f(mid);
        if ((fa < 0) === (fm < 0)) {
            a = mid;
            fa = fm;
        } else {
            b = mid;
            fb = fm;
        }
        if (b - a < 1e-13) {
            break;
        }
    }
    return (a + b) / 2;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Brent's method", () => {
    it("finds roots matching an independent bisection reference", () => {
        const cases: Array<{ func: string; a: number; b: number }> = [
            { func: "x2-2", a: 0, b: 2 },
            { func: "x3-x-2", a: 1, b: 2 },
            { func: "cos-x", a: 0, b: 1 },
            { func: "exp-2", a: 0, b: 1 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ ...testCase, tol: 1e-12, iterations: 60 })];
            checkFrames(frames);
            const last = frames[frames.length - 1]?.meta;
            const root = Number(last?.["root"]);
            expect(root).toBeGreaterThanOrEqual(testCase.a);
            expect(root).toBeLessThanOrEqual(testCase.b);
            expect(Math.abs(F[testCase.func]?.(root) ?? 0)).toBeLessThan(1e-8);
            expect(last?.["converged"]).toBe(true);
            expect(root).toBeCloseTo(bisection(F[testCase.func]!, testCase.a, testCase.b), 7);
        }
    });

    it("uses fewer evaluations than plain bisection on the default problem", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["iteration"])).toBeLessThan(30);
    });

    it("does not claim a root for an invalid bracket", () => {
        const frames = [...mod.run({ func: "x2-2", a: 2, b: 3, iterations: 8 })];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["converged"]).toBe(false);
        expect(last?.["note"]).toBe("invalid bracket");
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
