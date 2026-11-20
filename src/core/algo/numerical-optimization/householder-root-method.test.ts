/**
 * householder-root-method.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./householder-root-method";
import type { VisualFrame } from "@/types";

function evalPoly(c: number[], x: number): number {
    let r = 0;
    for (let i = c.length - 1; i >= 0; i -= 1) {
        r = r * x + (c[i] ?? 0);
    }
    return r;
}

/** Independent Newton solver with analytic derivative. */
function newton(c: number[], start: number): number {
    let x = start;
    for (let i = 0; i < 200; i += 1) {
        let f = 0;
        let df = 0;
        for (let j = 0; j < c.length; j += 1) {
            f += (c[j] ?? 0) * x ** j;
            if (j >= 1) {
                df += j * (c[j] ?? 0) * x ** (j - 1);
            }
        }
        if (df === 0) {
            break;
        }
        const next = x - f / df;
        if (Math.abs(next - x) < 1e-14) {
            x = next;
            break;
        }
        x = next;
    }
    return x;
}

function checkFrames(frames: VisualFrame[], coefficientCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(coefficientCount);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Householder root method", () => {
    it("finds roots that match an independent Newton solver", () => {
        const cases = [
            { c: [-5, -2, 0, 1], start: 2, order: 4 },
            { c: [-2, 0, 1], start: 1.5, order: 3 },
            { c: [-1, -3, 0, 1], start: 2, order: 5 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ coefficients: testCase.c, start: testCase.start, order: testCase.order, iterations: 40 })];
            checkFrames(frames, testCase.c.length);
            const finalMeta = frames[frames.length - 1]?.meta;
            const root = Number(finalMeta?.["root"]);
            const reference = newton(testCase.c, testCase.start);
            expect(finalMeta?.["converged"]).toBe(true);
            expect(Math.abs(root - reference)).toBeLessThan(1e-6);
            expect(Math.abs(evalPoly(testCase.c, root))).toBeLessThan(1e-8);
        }
    });

    it("higher orders converge in no more steps than order two", () => {
        const c = [-5, -2, 0, 1];
        const low = [...mod.run({ coefficients: c, start: 2, order: 2, iterations: 40 })];
        const high = [...mod.run({ coefficients: c, start: 2, order: 5, iterations: 40 })];
        const lowSteps = Number(low[low.length - 1]?.meta["iteration"]);
        const highSteps = Number(high[high.length - 1]?.meta["iteration"]);
        expect(highSteps).toBeLessThanOrEqual(lowSteps);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
