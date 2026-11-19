/**
 * knapsack-fractional.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./knapsack-fractional";
import type { VisualFrame } from "@/types";

interface Input {
    values: number[];
    weights: number[];
    capacity: number;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function resultOf(input: Input) {
    const frames = [...mod.run(input)];
    checkFrames(frames);
    const meta = frames[frames.length - 1]?.meta ?? {};
    return {
        total: meta["totalValue"] as number,
        taken: meta["taken"] as number[],
        order: meta["order"] as number[],
    };
}

function ratio(values: number[], weights: number[], i: number): number {
    return weights[i] === 0 ? Number.POSITIVE_INFINITY : (values[i] as number) / (weights[i] as number);
}

function zeroOneBrute(values: number[], weights: number[], capacity: number): number {
    const n = values.length;
    let best = 0;
    for (let mask = 0; mask < 1 << n; mask += 1) {
        let value = 0;
        let weight = 0;
        for (let i = 0; i < n; i += 1) {
            if (mask & (1 << i)) {
                value += values[i] as number;
                weight += weights[i] as number;
            }
        }
        if (weight <= capacity) best = Math.max(best, value);
    }
    return best;
}

describe("Fractional Knapsack", () => {
    it("solves the textbook example", () => {
        const got = resultOf({ values: [60, 100, 120], weights: [10, 20, 30], capacity: 50 });
        expect(got.total).toBeCloseTo(240, 6);
    });

    it("satisfies the greedy optimality certificate", () => {
        const cases: Input[] = [
            { values: [60, 100, 120], weights: [10, 20, 30], capacity: 50 },
            { values: [10, 5, 15, 7], weights: [2, 3, 5, 4], capacity: 9 },
            { values: [40, 100, 50, 60], weights: [10, 20, 30, 12], capacity: 40 },
            { values: [7, 9, 4], weights: [0, 3, 2], capacity: 2 },
        ];
        for (const input of cases) {
            const got = resultOf(input);
            let recomputed = 0;
            let usedWeight = 0;
            for (let i = 0; i < input.values.length; i += 1) {
                const fraction = got.taken[i] ?? 0;
                expect(fraction).toBeGreaterThanOrEqual(-1e-9);
                expect(fraction).toBeLessThanOrEqual(1 + 1e-9);
                recomputed += fraction * (input.values[i] as number);
                usedWeight += fraction * (input.weights[i] as number);
            }
            expect(recomputed).toBeCloseTo(got.total, 5);
            expect(usedWeight).toBeLessThanOrEqual(input.capacity + 1e-6);

            const ratios = input.values.map((_v, i) => ratio(input.values, input.weights, i));
            for (let a = 0; a < input.values.length; a += 1) {
                for (let b = 0; b < input.values.length; b += 1) {
                    const fa = got.taken[a] ?? 0;
                    const fb = got.taken[b] ?? 0;
                    if (fa < 1 - 1e-9 && fb > 1e-9) {
                        expect(ratios[a] as number).toBeLessThanOrEqual((ratios[b] as number) + 1e-9);
                    }
                }
            }
        }
    });

    it("never falls below the 0/1 optimum on integer instances", () => {
        let seed = 77;
        const rand = () => {
            seed = (1103515245 * seed + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const n = 2 + Math.floor(rand() * 5);
            const values = Array.from({ length: n }, () => 1 + Math.floor(rand() * 20));
            const weights = Array.from({ length: n }, () => 1 + Math.floor(rand() * 8));
            const capacity = 4 + Math.floor(rand() * 20);
            const got = resultOf({ values, weights, capacity });
            expect(got.total).toBeGreaterThanOrEqual(zeroOneBrute(values, weights, capacity) - 1e-6);
        }
    });

    it("handles zero capacity and an empty item set", () => {
        expect(resultOf({ values: [5, 9], weights: [1, 2], capacity: 0 }).total).toBe(0);
        expect(resultOf({ values: [], weights: [], capacity: 10 }).total).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
