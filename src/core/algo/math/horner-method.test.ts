/** horner-method.test.ts - Direct-evaluation cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./horner-method";
import type { VisualFrame } from "@/types";

function direct(coefficients: number[], x: number): number {
    return coefficients.reduce((sum, c, i) => sum + c * Math.pow(x, i), 0);
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const value = Number(frame.meta["value"]);
        expect(Number.isFinite(value)).toBe(true);
    });
}

describe("Horner's method", () => {
    it("matches direct polynomial evaluation across inputs", () => {
        const cases = [
            { coefficients: [2, -3, 0, 4, 1], x: 2 },
            { coefficients: [5], x: 7 },
            { coefficients: [1, 2, 3], x: -2 },
            { coefficients: [0, 0, 0, 9], x: 3 },
            { coefficients: [4, -1, 6, -2, 8, 0, 3], x: 1.5 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]!.meta;
            expect(final["value"]).toBeCloseTo(direct(input.coefficients, input.x), 9);
            expect(final["multiplications"]).toBe(Math.max(0, input.coefficients.length - 1));
        }
    });

    it("handles the empty polynomial", () => {
        const frames = [...mod.run({ coefficients: [], x: 5 })];
        expect(frames[0]!.meta["value"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
