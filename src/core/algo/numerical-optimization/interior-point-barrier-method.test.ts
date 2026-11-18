/**
 * interior-point-barrier-method.test.ts - Closed-form subproblem check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./interior-point-barrier-method";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(2);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const x = Number(frame.meta["x"]);
        expect(x).toBeLessThan(2);
        expect(Number.isFinite(x)).toBe(true);
    });
}

/** Closed-form minimizer of t (x-3)^2 / 2 - log(2-x) on x < 2. */
function subproblemMinimizer(t: number): number {
    return (5 * t - Math.sqrt(t * t + 4 * t)) / (2 * t);
}

describe("InteriorPointBarrierMethod", () => {
    it("matches the closed-form minimizer at every barrier round", () => {
        const frames = [...mod.run({ t0: 1, mu: 10, outer: 6 })];
        checkFrames(frames);
        let previous = -Infinity;
        for (let round = 1; round <= 6; round += 1) {
            const t = 10 ** (round - 1);
            const roundFrames = frames.filter((f) => f.meta["outer"] === round);
            expect(roundFrames.length).toBeGreaterThan(1);
            const last = roundFrames[roundFrames.length - 1]?.meta["x"] as number;
            expect(last).toBeCloseTo(subproblemMinimizer(t), 8);
            expect(last).toBeGreaterThan(previous);
            previous = last;
        }
    });

    it("approaches the constrained optimum from inside the boundary", () => {
        const frames = [...mod.run({ outer: 8 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["x"]).toBeGreaterThan(1.9999);
        expect(final?.["x"]).toBeLessThan(2);
        expect(Number(final?.["gap"])).toBeLessThan(1e-7);
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
