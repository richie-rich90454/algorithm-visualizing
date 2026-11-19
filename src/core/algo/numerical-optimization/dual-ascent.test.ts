/**
 * dual-ascent.test.ts - Strong duality, dual feasibility, monotonicity,
 * frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./dual-ascent";
import type { VisualFrame } from "@/types";

function primalOptimum(values: number[], weights: number[], capacity: number): number {
    const items = values.map((value, i) => ({ value, weight: weights[i] ?? 1 }));
    items.sort((a, b) => b.value / b.weight - a.value / a.weight);
    let remaining = capacity;
    let total = 0;
    for (const item of items) {
        if (remaining <= 0) break;
        const take = Math.min(1, remaining / item.weight);
        total += take * item.value;
        remaining -= take * item.weight;
    }
    return total;
}

function dualValue(values: number[], weights: number[], capacity: number, lambda: number): number {
    return capacity * lambda + values.reduce((sum, v, i) => sum + Math.max(0, v - (weights[i] ?? 1) * lambda), 0);
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("dual ascent", () => {
    const input = mod.defaultInput as { values: number[]; weights: number[]; capacity: number };

    it("reaches strong duality on the default input", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.values.length);
        const final = frames[frames.length - 1]?.meta;
        const expectedPrimal = primalOptimum(input.values, input.weights, input.capacity);
        expect(final?.["primal"]).toBeCloseTo(expectedPrimal, 10);
        expect(final?.["dual"]).toBeCloseTo(expectedPrimal, 10);
        expect(Math.abs(Number(final?.["gap"]))).toBeLessThan(1e-9);
        expect(final?.["done"]).toBe(true);
    });

    it("keeps the dual feasible and above the primal at every breakpoint", () => {
        const frames = [...mod.run(input)];
        const expectedPrimal = primalOptimum(input.values, input.weights, input.capacity);
        let previous = Infinity;
        for (const frame of frames) {
            const lambda = Number(frame.meta["lambda"]);
            const dual = Number(frame.meta["dual"]);
            expect(lambda).toBeGreaterThanOrEqual(0);
            expect(dual).toBeCloseTo(dualValue(input.values, input.weights, input.capacity, lambda), 10);
            expect(dual).toBeGreaterThanOrEqual(expectedPrimal - 1e-9);
            expect(dual).toBeLessThanOrEqual(previous + 1e-9);
            previous = dual;
            for (let i = 0; i < input.values.length; i += 1) {
                const mu = Math.max(0, (input.values[i] ?? 0) - (input.weights[i] ?? 1) * lambda);
                expect(mu + (input.weights[i] ?? 1) * lambda).toBeGreaterThanOrEqual((input.values[i] ?? 0) - 1e-9);
            }
        }
    });

    it("matches a brute-force bound over a dense lambda grid", () => {
        const cases: Array<{ values: number[]; weights: number[]; capacity: number }> = [
            { values: [8, 7, 6, 4], weights: [4, 3, 3, 2], capacity: 6 },
            { values: [5, 3], weights: [2, 1], capacity: 2 },
            { values: [10, 9, 4], weights: [5, 3, 2], capacity: 9 },
            { values: [2, 2, 2], weights: [1, 1, 1], capacity: 5 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.values.length);
            const final = frames[frames.length - 1]?.meta;
            const primal = primalOptimum(testCase.values, testCase.weights, testCase.capacity);
            let gridMin = Infinity;
            for (let step = 0; step <= 20000; step += 1) {
                const lambda = step * 0.001;
                gridMin = Math.min(gridMin, dualValue(testCase.values, testCase.weights, testCase.capacity, lambda));
            }
            expect(Number(final?.["dual"])).toBeLessThanOrEqual(gridMin + 1e-6);
            expect(Number(final?.["dual"])).toBeCloseTo(primal, 6);
        }
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
