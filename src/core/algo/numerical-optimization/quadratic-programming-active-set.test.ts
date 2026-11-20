/**
 * quadratic-programming-active-set.test.ts - Brute-force optimality, feasibility, frame shape.
 */

import { describe, expect, it } from "vitest";
import mod, { activeSetQP, isFeasible, objective, type QPProblem } from "./quadratic-programming-active-set";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["feasible"]).toBe(true);
    });
}

/** Independent grid search for the constrained minimum. */
function bruteForceMin(problem: QPProblem, lo: number, hi: number, step: number): number {
    let best = Infinity;
    for (let x1 = lo; x1 <= hi + 1e-12; x1 += step) {
        for (let x2 = lo; x2 <= hi + 1e-12; x2 += step) {
            const x = [x1, x2];
            if (isFeasible(problem, x, 1e-9)) best = Math.min(best, objective(problem, x));
        }
    }
    return best;
}

const defaultProblem: QPProblem = {
    G: [[1, 0], [0, 1]],
    c: [-1, -2],
    A: [[1, 1], [-1, 0], [0, -1]],
    b: [2, 0, 0],
};

describe("Quadratic Programming Active Set", () => {
    it("matches a brute-force grid minimum and keeps every iterate feasible", () => {
        const data = activeSetQP(defaultProblem, [0, 0]);
        expect(data.feasible).toBe(true);
        expect(data.kktOk).toBe(true);
        expect(data.solution[0]).toBeCloseTo(0.5, 6);
        expect(data.solution[1]).toBeCloseTo(1.5, 6);
        expect(data.objective).toBeCloseTo(-2.25, 6);
        expect(data.objective).toBeLessThanOrEqual(bruteForceMin(defaultProblem, 0, 2, 0.01) + 1e-6);
        for (const entry of data.iterations) {
            expect(isFeasible(defaultProblem, entry.x)).toBe(true);
        }
    });

    it("solves a clamped least-squares problem from several feasible starts", () => {
        const problem: QPProblem = {
            G: [[2, 0], [0, 2]],
            c: [-2, -4],
            A: [[-1, 0], [1, 0], [0, -1], [0, 1]],
            b: [0, 0.5, 0, 1],
        };
        for (const start of [[0.25, 0.5], [0, 0], [0.5, 1]]) {
            const data = activeSetQP(problem, start);
            expect(data.feasible).toBe(true);
            expect(data.solution[0]).toBeCloseTo(0.5, 5);
            expect(data.solution[1]).toBeCloseTo(1, 5);
            expect(data.objective).toBeCloseTo(-3.75, 5);
            expect(data.objective).toBeLessThanOrEqual(bruteForceMin(problem, 0, 1, 0.01) + 1e-6);
        }
    });

    it("emits well-formed frames and terminates cleanly", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 2);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["kktOk"]).toBe(true);
        expect(Number(final?.["objective"])).toBeCloseTo(-2.25, 5);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
