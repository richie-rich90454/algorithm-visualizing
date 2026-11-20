/**
 * selinger-join-ordering.test.ts - Exhaustive binary-tree brute force, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./selinger-join-ordering";
import type { VisualFrame } from "@/types";

interface Result {
    cost: number;
    card: number;
}

/** Brute force: enumerate every binary join tree, no memoization. */
function bruteForce(card: number[], sel: number): number {
    const cardOf = (items: number[]): number => {
        let value = 1;
        for (const i of items) value *= card[i] as number;
        for (let a = 0; a < items.length; a += 1) {
            for (let b = a + 1; b < items.length; b += 1) value *= sel;
        }
        return value;
    };
    const trees = (items: number[]): Result[] => {
        if (items.length === 1) return [{ cost: 0, card: cardOf(items) }];
        const results: Result[] = [];
        const total = 1 << items.length;
        for (let sub = 1; sub < total - 1; sub += 1) {
            if (!(sub & 1)) continue; // keep the first item on the left to deduplicate
            const leftItems: number[] = [];
            const rightItems: number[] = [];
            for (let k = 0; k < items.length; k += 1) {
                if (sub & (1 << k)) leftItems.push(items[k] as number);
                else rightItems.push(items[k] as number);
            }
            for (const left of trees(leftItems)) {
                for (const right of trees(rightItems)) {
                    let across = 1;
                    for (const _a of leftItems) {
                        for (const _b of rightItems) across *= sel;
                    }
                    const combined = left.card * right.card * across;
                    results.push({ cost: left.cost + right.cost + combined, card: combined });
                }
            }
        }
        return results;
    };
    return Math.min(...trees(Array.from({ length: card.length }, (_, i) => i)).map((r) => r.cost));
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe((1 << n) + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(1 << n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Selinger Join Ordering", () => {
    it("matches exhaustive enumeration of all binary join trees", () => {
        const cases = [
            { cardinalities: [100, 40, 25, 15], selectivity: 0.1 },
            { cardinalities: [50, 30, 20, 10], selectivity: 0.25 },
            { cardinalities: [8, 6, 4, 3, 2], selectivity: 0.5 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames, testCase.cardinalities.length);
            const final = frames[frames.length - 1];
            expect(Number(final?.meta["bestCost"])).toBeCloseTo(
                bruteForce(testCase.cardinalities, testCase.selectivity),
                9,
            );
            const order = final?.meta["bestOrder"] as number[];
            expect([...order].sort((a, b) => a - b)).toEqual(
                Array.from({ length: testCase.cardinalities.length }, (_, i) => i),
            );
        }
    });

    it("stores a cost consistent with the best split for every subset", () => {
        const frames = [...mod.run({ cardinalities: [100, 40, 25, 15], selectivity: 0.1 })];
        const final = frames[frames.length - 1];
        const masks = final?.meta["subsetMasks"] as number[];
        const costs = final?.meta["subsetCosts"] as number[];
        const table: Record<string, number> = {};
        masks.forEach((mask, i) => {
            table[String(mask)] = costs[i] as number;
        });
        const cards = final?.meta["cardinalityTable"] as number[];
        const n = 4;
        for (let mask = 2; mask < (1 << n); mask += 1) {
            let bits = mask;
            let count = 0;
            while (bits > 0) {
                bits &= bits - 1;
                count += 1;
            }
            if (count < 2) continue;
            let best = Infinity;
            for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
                const other = mask ^ sub;
                if (other === 0) continue;
                best = Math.min(best, (table[String(sub)] as number) + (table[String(other)] as number) + (cards[mask] as number));
            }
            expect(table[String(mask)]).toBeCloseTo(best, 9);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
