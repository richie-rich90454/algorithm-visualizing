/**
 * sdca.test.ts - Dual coordinate ascent correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { dual, primal, ridgePrimalOptimum } from "./sdca";
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

/** Brute-force primal scan over a fine grid surrounding the claimed optimum. */
function brutePrimal(data: { a: number[]; y: number }[], lambda: number, center: number[]): number {
    let best = Number.POSITIVE_INFINITY;
    for (let dx = -2; dx <= 2; dx += 0.05) {
        for (let dy = -2; dy <= 2; dy += 0.05) {
            const w = [center[0] as number + dx, center[1] as number + dy];
            best = Math.min(best, primal(data, w, lambda));
        }
    }
    return best;
}

describe("SDCA", () => {
    it("reaches the same weights as the ridge normal equations", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["converged"]).toBe(true);
        const w = final?.["w"] as number[];
        const optimum = final?.["optimum"] as number[];
        const independent = ridgePrimalOptimum((mod.defaultInput as { data: { a: number[]; y: number }[] }).data, 0.1);
        independent.forEach((value, i) => expect(optimum[i]).toBeCloseTo(value, 10));
        w.forEach((value, i) => expect(value).toBeCloseTo(optimum[i] as number, 3));
    });

    it("has a nonnegative gap that vanishes and a primal value matching brute force", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta;
        const gaps = final?.["gaps"] as number[];
        gaps.forEach((gap) => expect(gap).toBeGreaterThanOrEqual(-1e-9));
        expect(Number(final?.["finalGap"])).toBeLessThan(1e-6);
        const data = (mod.defaultInput as { data: { a: number[]; y: number }[] }).data;
        const optimum = final?.["optimum"] as number[];
        expect(Number(final?.["primalValue"])).toBeLessThanOrEqual(brutePrimal(data, 0.1, optimum) + 1e-9);
        const alpha = final?.["alpha"] as number[];
        const w = final?.["w"] as number[];
        expect(Number(final?.["dualValue"])).toBeCloseTo(dual(data, alpha, w, 0.1), 10);
    });

    it("works on an unbalanced data table", () => {
        const data = [{ a: [3, 1], y: 2 }, { a: [1, -2], y: -1 }, { a: [0, 1], y: 5 }];
        const frames = [...mod.run({ data, lambda: 0.4, epochs: 60 })];
        const final = frames[frames.length - 1]?.meta;
        const w = final?.["w"] as number[];
        const optimum = ridgePrimalOptimum(data, 0.4);
        w.forEach((value, i) => expect(value).toBeCloseTo(optimum[i] as number, 2));
        expect(Number(final?.["finalGap"])).toBeLessThan(1e-4);
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
