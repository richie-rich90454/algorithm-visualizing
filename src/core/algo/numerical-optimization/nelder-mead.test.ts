/**
 * nelder-mead.test.ts - Convergence vs brute-force grid, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { nelderMead, objective } from "./nelder-mead";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Number.isFinite(frame.entities[0]?.x)).toBe(true);
    });
}

/** Brute-force grid minimum over a bounded square. */
function gridMinimum(f: (p: number[]) => number, lo: number, hi: number, step: number): number {
    let best = Infinity;
    for (let x = lo; x <= hi + 1e-9; x += step) {
        for (let y = lo; y <= hi + 1e-9; y += step) {
            best = Math.min(best, f([x, y]));
        }
    }
    return best;
}

describe("Nelder-Mead", () => {
    it("finds the minimum of a convex quadratic to high precision", () => {
        const f = (p: number[]) => objective("quadratic", p[0] ?? 0, p[1] ?? 0);
        const result = nelderMead(f, [[0, 0], [1, 0], [0, 1]], 200);
        expect(result.best[0]).toBeCloseTo(1, 3);
        expect(result.best[1]).toBeCloseTo(-2, 3);
        expect(result.value).toBeLessThan(1e-6);
    });

    it("finds the origin of a sphere function", () => {
        const f = (p: number[]) => objective("sphere", p[0] ?? 0, p[1] ?? 0);
        const result = nelderMead(f, [[2, 3], [3, 3], [2, 4]], 200);
        expect(result.value).toBeLessThan(1e-8);
        expect(Math.hypot(result.best[0] ?? 0, result.best[1] ?? 0)).toBeLessThan(1e-3);
    });

    it("beats or matches a brute-force grid on Rosenbrock", () => {
        const f = (p: number[]) => objective("rosenbrock", p[0] ?? 0, p[1] ?? 0);
        const result = nelderMead(f, [[-1.2, 1], [-0.2, 1], [-1.2, 2]], 400);
        const gridBest = gridMinimum(f, -2, 2, 0.02);
        expect(result.value).toBeLessThanOrEqual(gridBest + 1e-6);
        expect(result.value).toBeLessThan(0.1);
    });

    it("best value never increases across iterations", () => {
        const f = (p: number[]) => objective("rosenbrock", p[0] ?? 0, p[1] ?? 0);
        const result = nelderMead(f, [[-1.2, 1], [-0.2, 1], [-1.2, 2]], 100);
        for (let i = 1; i < result.history.length; i += 1) {
            expect(result.history[i]?.value as number).toBeLessThanOrEqual(result.history[i - 1]?.value as number);
        }
    });

    it("emits a final best point matching the algorithm result", () => {
        const frames = [...mod.run({ func: "quadratic", start: [0, 0], step: 1, iterations: 40 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["value"])).toBeLessThan(1e-4);
        expect((final?.["best"] as number[])[0]).toBeCloseTo(1, 2);
        expect((final?.["best"] as number[])[1]).toBeCloseTo(-2, 2);
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
