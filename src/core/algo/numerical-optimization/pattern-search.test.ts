/**
 * pattern-search.test.ts - Brute-force minimizer cross-check, monotone
 * objective, step-shrink check, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./pattern-search";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent objective: squared distance to the target. */
function objective(p: number[], target: number[]): number {
    return (p[0] - target[0]) ** 2 + (p[1] - target[1]) ** 2;
}

describe("Compass Pattern Search", () => {
    it("finds the brute-force quadratic minimizer", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        const x = last["x"] as number[];
        const target = (mod.defaultInput as { target: number[] }).target;
        expect(Math.abs(x[0] - target[0])).toBeLessThan(1e-3);
        expect(Math.abs(x[1] - target[1])).toBeLessThan(1e-3);
        expect(objective(x, target)).toBeLessThan(1e-6);
        expect(objective(x, target)).toBeLessThanOrEqual(objective([0, 0], target));
    });

    it("keeps the objective monotone and the step nonincreasing", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        let prevObjective = Infinity;
        let prevStep = Infinity;
        for (const frame of frames) {
            const value = Number(frame.meta["objective"]);
            const step = Number(frame.meta["step"]);
            expect(value).toBeLessThanOrEqual(prevObjective + 1e-12);
            expect(step).toBeLessThanOrEqual(prevStep);
            prevObjective = value;
            prevStep = step;
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
