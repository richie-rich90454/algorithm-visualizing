/** elastic-weight-consolidation.test.ts - Reference match, property checks, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./elastic-weight-consolidation";
import type { VisualFrame } from "@/types";

interface Input {
    params: number[];
    optimum: number[];
    fisher: number[];
    lambda: number;
}

function reference(input: Input) {
    const n = Math.max(input.params.length, input.optimum.length, input.fisher.length);
    const at = (a: number[], i: number): number => a[i] ?? 0;
    const penalties: number[] = [];
    let total = 0;
    for (let i = 0; i < n; i += 1) {
        const diff = at(input.params, i) - at(input.optimum, i);
        const p = 0.5 * input.lambda * at(input.fisher, i) * diff * diff;
        penalties.push(p);
        total += p;
    }
    return { penalties, total };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Elastic Weight Consolidation", () => {
    it("matches a direct quadratic-penalty computation", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["penalties"]).toEqual(expected.penalties);
        expect(final?.["totalPenalty"]).toBe(expected.total);
    });

    it("has zero penalty when parameters equal the saved optimum", () => {
        const frames = [...mod.run({ params: [1, 2, 3], optimum: [1, 2, 3], fisher: [5, 5, 5], lambda: 100 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["totalPenalty"]).toBe(0);
        expect(final?.["penalties"]).toEqual([0, 0, 0]);
    });

    it("penalizes only Fisher-weighted parameters", () => {
        const frames = [...mod.run({ params: [2, 2], optimum: [1, 1], fisher: [1, 0], lambda: 10 })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["penalties"]).toEqual([5, 0]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
