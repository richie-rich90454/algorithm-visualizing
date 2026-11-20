/** backtracking-line-search.test.ts - Independent Armijo recomputation, descent, frame shape. */

import { describe, expect, it } from "vitest";
import mod, { backtrackingLineSearch } from "./backtracking-line-search";
import type { VisualFrame } from "@/types";

const quadratic = (x: number): number => (x - 3) * (x - 3);

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Backtracking line search", () => {
    it("accepts the expected halved step on a known quadratic", () => {
        const result = backtrackingLineSearch(quadratic, 0, 6, -36, { rho: 0.5, c1: 1e-4 });
        expect(result.step).toBe(0.5);
        expect(result.trials.length).toBe(2);
        expect(result.trials[0]?.accepted).toBe(false);
        expect(result.trials[1]?.accepted).toBe(true);
        expect(result.fTrial).toBeLessThan(result.fStart);
    });

    it("satisfies Armijo independently for every trial over many inputs", () => {
        for (const start of [-2, 0, 1, 4]) {
            for (const direction of [3, 6, -4]) {
                const slope = 2 * (start - 3) * direction;
                if (slope >= 0) { continue; }
                for (const c1 of [1e-4, 0.1, 0.4]) {
                    const result = backtrackingLineSearch(quadratic, start, direction, slope, { rho: 0.5, c1 });
                    for (const trial of result.trials) {
                        const bound = result.fStart + c1 * trial.t * slope;
                        expect(bound).toBeCloseTo(trial.bound, 12);
                        expect(trial.accepted).toBe(trial.value <= bound);
                    }
                    const accepted = result.trials.find((t) => t.accepted);
                    expect(accepted).toBeDefined();
                    expect(quadratic(start + result.step * direction)).toBeLessThan(result.fStart);
                }
            }
        }
    });

    it("respects the iteration and minimum-step limits", () => {
        const flat = (): number => 1;
        const result = backtrackingLineSearch(flat, 0, 1, -1, { initial: 1, rho: 0.5, maxIter: 5 });
        expect(result.trials.length).toBe(5);
        expect(result.step).toBeCloseTo(1 / 16, 12);
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) { frames.push(frame); }
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["accepted"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
