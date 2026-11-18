/**
 * romberg-integration.test.ts - Known integrals, convergence, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { evaluate, exactIntegral, rombergTable } from "./romberg-integration";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], levels: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(levels);
        expect(frame.meta["cols"]).toBe(levels);
    });
}

describe("Romberg integration", () => {
    it("the first trapezoid entry matches the composite trapezoidal rule", () => {
        const table = rombergTable((x) => x * x, 0, 1, 4);
        expect(table[0]?.[0]).toBeCloseTo(0.5, 12);
        expect(table[1]?.[0]).toBeCloseTo(0.375, 12);
        expect(table[2]?.[0]).toBeCloseTo(0.34375, 12);
    });

    it("matches closed-form integrals to high accuracy", () => {
        const cases = [
            { func: "x^2" as const, a: 0, b: 1 },
            { func: "sin" as const, a: 0, b: Math.PI },
            { func: "exp" as const, a: 0, b: 1 },
            { func: "cos" as const, a: 0, b: 1 },
            { func: "sin" as const, a: -1, b: 2 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ ...testCase, levels: 7 })];
            checkFrames(frames, 7);
            const final = frames[frames.length - 1]?.meta;
            const expected = exactIntegral(testCase.func, testCase.a, testCase.b);
            expect(Number(final?.["estimate"])).toBeCloseTo(expected, 9);
            expect(Number(final?.["exact"])).toBeCloseTo(expected, 12);
            expect(Number(final?.["error"])).toBeLessThan(1e-7);
        }
    });

    it("earlier columns are less accurate than later ones", () => {
        const table = rombergTable((x) => Math.sin(x), 0, Math.PI, 6);
        const exact = 2;
        const lastRow = table[5] as number[];
        expect(Math.abs((lastRow[0] as number) - exact)).toBeGreaterThan(Math.abs((lastRow[5] as number) - exact));
    });

    it("evaluate matches known function values", () => {
        expect(evaluate("x^2", 3)).toBe(9);
        expect(evaluate("sin", 0)).toBeCloseTo(0, 12);
        expect(evaluate("exp", 0)).toBe(1);
        expect(evaluate("cos", 0)).toBe(1);
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
