/**
 * test-and-set.test.ts - Mutual exclusion correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./test-and-set";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent enumeration of all orderings to count lock winners. */
function bruteWinnerCounts(n: number): number[] {
    const results: number[] = [];
    const visit = (order: number[]) => {
        if (order.length === n) {
            let locked = false;
            let winners = 0;
            for (const _p of order) {
                const old = locked;
                locked = true;
                if (!old) {
                    winners += 1;
                }
            }
            results.push(winners);
            return;
        }
        for (let i = 0; i < n; i += 1) {
            if (!order.includes(i)) {
                visit([...order, i]);
            }
        }
    };
    visit([]);
    return results;
}

describe("Test-and-Set Lock", () => {
    it("has exactly one winner in every interleaving", () => {
        for (const n of [1, 2, 3, 4]) {
            const frames = [...mod.run({ processes: n })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["mutualExclusion"]).toBe(true);
            expect(Number(final?.["interleavings"])).toBe(bruteWinnerCounts(n).length);
            expect(bruteWinnerCounts(n).every((w) => w === 1)).toBe(true);
        }
    });

    it("always marks the first actor in each ordering as the winner", () => {
        const frames = [...mod.run({ processes: 3 })];
        const stepFrames = frames.filter((f) => f.meta["actor"] !== undefined);
        const byInterleaving = new Map<number, VisualFrame[]>();
        for (const frame of stepFrames) {
            const key = Number(frame.meta["interleaving"]);
            byInterleaving.set(key, [...(byInterleaving.get(key) ?? []), frame]);
        }
        for (const steps of byInterleaving.values()) {
            const first = steps[0] as VisualFrame;
            expect(first.meta["oldValue"]).toBe(false);
            expect(first.meta["winner"]).toBe(first.meta["actor"]);
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
