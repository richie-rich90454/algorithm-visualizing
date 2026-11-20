/**
 * implicit-explicit-method.test.ts - IMEX stability and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { constantForcingExact, imexReference, imexStep } from "./implicit-explicit-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("IMEX Euler", () => {
    it("matches backward Euler exactly with zero forcing", () => {
        for (const h of [0.01, 0.2, 1.5]) {
            const y = imexStep(1, -8, h, 0, 0, "constant");
            expect(y).toBeCloseTo(1 / (1 + 8 * h), 12);
        }
    });

    it("converges to the analytic affine solution for constant forcing", () => {
        let y = 1;
        const h = 0.05;
        for (let k = 0; k < 40; k += 1) {
            y = imexStep(y, -3, h, 0, 2, "constant");
        }
        expect(y).toBeCloseTo(constantForcingExact(-3, 1, 2, 40 * h), 2);
        const coarse = [...mod.run({ lambda: -3, h: 0.1, steps: 20, amplitude: 2, forcingMode: "constant" })];
        const fine = [...mod.run({ lambda: -3, h: 0.05, steps: 40, amplitude: 2, forcingMode: "constant" })];
        const coarseError = Number(coarse.at(-1)?.meta["finalError"]);
        const fineError = Number(fine.at(-1)?.meta["finalError"]);
        expect(fineError).toBeLessThan(coarseError);
    });

    it("stays stable under a large stiff coefficient with oscillatory forcing", () => {
        const frames = [...mod.run({ ...(mod.defaultInput as Record<string, unknown>), lambda: -80, h: 0.2 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["stable"]).toBe(true);
        expect(Number.isFinite(Number(final?.["finalValue"]))).toBe(true);
        expect(Number(final?.["finalError"])).toBeLessThan(0.5);
        expect(imexReference(-8, 0.05, 3, 1, 2, "cosine")).toHaveLength(4);
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
