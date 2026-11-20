/**
 * exponential-integrator.test.ts - Integrator accuracy and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { expPhi, exponentialStep, rk4Reference } from "./exponential-integrator";
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

describe("Exponential Integrator", () => {
    it("computes phi1 as a stable limit near zero", () => {
        const a = expPhi(1e-9);
        expect(a.phi1).toBeCloseTo(1 + 5e-10, 9);
        const b = expPhi(-3);
        expect(b.phi1).toBeCloseTo((Math.exp(-3) - 1) / -3, 12);
    });

    it("is exact for a constant forcing against the analytic affine solution", () => {
        const lambda = -2;
        const c = 1;
        let y = 0.3;
        const h = 0.07;
        for (let k = 0; k < 20; k += 1) {
            y = exponentialStep(y, lambda, h, c, "constant");
            const t = (k + 1) * h;
            const equilibrium = -c / lambda;
            const exact = equilibrium + (0.3 - equilibrium) * Math.exp(lambda * t);
            expect(y).toBeCloseTo(exact, 10);
        }
    });

    it("tracks a fine RK4 reference and improves when the step halves", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["accurate"]).toBe(true);
        const coarse = Number(final?.["finalError"]);
        const fineInput = { ...(mod.defaultInput as Record<string, unknown>), h: 0.025, steps: 60 };
        const fineFrames = [...mod.run(fineInput)];
        const fine = Number(fineFrames[fineFrames.length - 1]?.meta["finalError"]);
        expect(fine).toBeLessThan(coarse);
        const reference = rk4Reference(-2, 0.05, 5, 1, 1, "quadratic");
        expect(reference).toHaveLength(6);
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
