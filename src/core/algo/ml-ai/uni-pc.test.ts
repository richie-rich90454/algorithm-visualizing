/** uni-pc.test.ts - Independent ODE reference, second-order convergence, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod, { uniPcSolve } from "./uni-pc";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("UniPC", () => {
    it("matches the analytic solution for a linear ODE", () => {
        const lambda = -1;
        const x0 = 1;
        const h = 0.01;
        const steps = 100;
        const solution = uniPcSolve(lambda, x0, h, steps);
        const final = solution[solution.length - 1];
        expect(final?.x).toBeCloseTo(x0 * Math.exp(lambda * h * steps), 6);
    });

    it("is second order: halving the step size cuts the error about fourfold", () => {
        const lambda = -1.5;
        const x0 = 2;
        const endTime = 1;
        const exact = x0 * Math.exp(lambda * endTime);
        const coarse = uniPcSolve(lambda, x0, 0.1, 10);
        const fine = uniPcSolve(lambda, x0, 0.05, 20);
        const coarseErr = Math.abs((coarse[coarse.length - 1]?.x ?? 0) - exact);
        const fineErr = Math.abs((fine[fine.length - 1]?.x ?? 0) - exact);
        expect(fineErr).toBeLessThan(coarseErr);
        expect(coarseErr / Math.max(fineErr, 1e-12)).toBeGreaterThan(2.5);
    });

    it("matches the predictor and corrector formulas step by step", () => {
        const sol = uniPcSolve(-1, 1, 0.2, 4);
        const first = sol[1];
        const pred1 = 1 + 0.2 * (-1) * 1;
        expect(first?.predicted).toBeCloseTo(pred1, 12);
        expect(first?.corrected).toBeCloseTo(1 + 0.2 * 0.5 * (-1 + -1 * pred1), 12);
        const second = sol[2];
        const f0 = sol[0]?.f ?? 0;
        expect(second?.predicted).toBeCloseTo((first?.x ?? 0) + 0.2 * (1.5 * (first?.f ?? 0) - 0.5 * f0), 12);
    });

    it("emits well-formed frames consistent with the reference", () => {
        const input = mod.defaultInput as { lambda: number; x0: number; h: number; steps: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = uniPcSolve(input.lambda, input.x0, input.h, input.steps);
        const final = frames[frames.length - 1]?.meta["trajectory"] as number[];
        final.forEach((v, i) => expect(v).toBeCloseTo(expected[i]?.x ?? 0, 10));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
