/**
 * branch-and-bound.test.ts - Brute-force optimality, bound validity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { branchAndBound, fractionalBound, type KnapsackItem } from "./branch-and-bound";
import type { VisualFrame } from "@/types";

/** Exhaustive 2^n reference for 0/1 knapsack. */
function bruteForce(items: KnapsackItem[], capacity: number): number {
    let best = 0;
    for (let mask = 0; mask < 1 << items.length; mask += 1) {
        let weight = 0;
        let value = 0;
        for (let i = 0; i < items.length; i += 1) {
            if (mask & (1 << i)) {
                weight += items[i]!.weight;
                value += items[i]!.value;
            }
        }
        if (weight <= capacity) best = Math.max(best, value);
    }
    return best;
}

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
        expect(frame.meta).toBeDefined();
    });
}

describe("Branch and Bound", () => {
    it("matches brute-force optimum on random instances", () => {
        let seed = 5150;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed;
        };
        for (let trial = 0; trial < 120; trial += 1) {
            const n = 1 + (rand() % 10);
            const items = Array.from({ length: n }, () => ({
                weight: 1 + (rand() % 12),
                value: 1 + (rand() % 25),
            }));
            const capacity = rand() % 40;
            const result = branchAndBound(items, capacity);
            expect(result.bestValue).toBe(bruteForce(items, capacity));

            // The reported solution is feasible and its value is consistent.
            let weight = 0;
            let value = 0;
            for (let i = 0; i < n; i += 1) {
                if (result.bestTaken[i]) {
                    weight += items[i]!.weight;
                    value += items[i]!.value;
                }
            }
            expect(weight).toBeLessThanOrEqual(capacity);
            expect(value).toBe(result.bestValue);

            // Each node's bound is its value plus a nonnegative relaxation.
            for (const node of result.trace) {
                expect(node.bound).toBeGreaterThanOrEqual(node.value - 1e-9);
                expect(node.bound + 1e-9).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it("computes the fractional relaxation exactly", () => {
        const items = [{ weight: 2, value: 6 }, { weight: 3, value: 10 }];
        expect(fractionalBound(items, 0)).toBeCloseTo(0);
        // The weight-3, value-10 item has the higher value density.
        expect(fractionalBound(items, 2)).toBeCloseTo(10 * (2 / 3));
        expect(fractionalBound(items, 5)).toBeCloseTo(16);
        expect(fractionalBound(items, 6)).toBeCloseTo(16);
        // Take the dense item whole, then half of the weight-2, value-6 item.
        expect(fractionalBound(items, 3.5)).toBeCloseTo(10 + 6 * (0.5 / 2));
    });

    it("produces well-formed frames with the optimal answer in the final frame", () => {
        const input = mod.defaultInput as { items: KnapsackItem[]; capacity: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.items.length);
        expect(frames[frames.length - 1]?.meta["best"]).toBe(bruteForce(input.items, input.capacity));
        expect(Number(frames[frames.length - 1]?.meta["nodes"])).toBeGreaterThan(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
