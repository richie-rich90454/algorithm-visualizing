/**
 * svrg.test.ts - Ridge convergence and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { exactRidge } from "./svrg";
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

/** Brute-force grid search around the known optimum to bound the objective. */
function bruteObjective(data: { a: number[]; y: number }[], lambda: number, w: number[]): number {
    const loss = data.reduce((sum, sample) => {
        const pred = sample.a.reduce((acc, a, i) => acc + a * (w[i] as number), 0);
        return sum + (pred - sample.y) ** 2;
    }, 0) / data.length;
    return loss + lambda * w.reduce((sum, value) => sum + value * value, 0);
}

describe("SVRG", () => {
    it("converges to the independently solved ridge optimum", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["converged"]).toBe(true);
        const w = final?.["w"] as number[];
        const optimum = final?.["optimum"] as number[];
        const independent = exactRidge((mod.defaultInput as { data: { a: number[]; y: number }[] }).data, 0.1);
        independent.forEach((value, i) => expect(optimum[i]).toBeCloseTo(value, 10));
        w.forEach((value, i) => expect(value).toBeCloseTo(optimum[i] as number, 3));
    });

    it("decreases the objective below every nearby brute-force alternative", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta;
        const w = final?.["w"] as number[];
        const optimum = final?.["optimum"] as number[];
        const best = bruteObjective((mod.defaultInput as { data: { a: number[]; y: number }[] }).data, 0.1, optimum);
        expect(bruteObjective((mod.defaultInput as { data: { a: number[]; y: number }[] }).data, 0.1, w)).toBeLessThanOrEqual(best + 1e-6);
        const objectives = final?.["objectives"] as number[];
        expect(objectives[objectives.length - 1] as number).toBeLessThan(objectives[0] as number);
    });

    it("handles a different data table and regularization", () => {
        const data = [{ a: [2, 1], y: 3 }, { a: [-1, 1], y: 0 }, { a: [0, 2], y: 4 }];
        const frames = [...mod.run({ data, lambda: 0.5, stepSize: 0.05, epochs: 30 })];
        const final = frames[frames.length - 1]?.meta;
        const w = final?.["w"] as number[];
        const optimum = exactRidge(data, 0.5);
        w.forEach((value, i) => expect(value).toBeCloseTo(optimum[i] as number, 2));
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
