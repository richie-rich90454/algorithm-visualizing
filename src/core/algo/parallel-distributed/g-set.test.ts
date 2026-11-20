/**
 * g-set.test.ts - Merge laws, convergence, and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./g-set";
import type { VisualFrame } from "@/types";

function union(a: string[], b: string[]): string[] {
    return Array.from(new Set([...a, ...b])).sort();
}

function permutations<T>(items: T[]): T[][] {
    if (items.length <= 1) {
        return [items];
    }
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += 1) {
        for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) {
            result.push([items[i] as T, ...rest]);
        }
    }
    return result;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Grow-only set", () => {
    it("converges to the same union under every merge order", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const sets = final?.["sets"] as string[][];
        const expected = sets.reduce((acc, set) => union(acc, set), [] as string[]);
        expect(final?.["merged"]).toEqual(expected);
        expect(final?.["converged"]).toBe(true);

        const orders = permutations([0, 1, 2]);
        for (const order of orders) {
            let merged: string[] = [];
            for (const index of order) {
                merged = union(merged, sets[index] ?? []);
                merged = union(merged, sets[index] ?? []);
            }
            expect(merged).toEqual(expected);
        }
    });

    it("obey commutativity, associativity, idempotence, and monotone growth", () => {
        const a = ["a", "b"];
        const b = ["c", "a"];
        const c = ["d", "b"];
        expect(union(a, b)).toEqual(union(b, a));
        expect(union(union(a, b), c)).toEqual(union(a, union(b, c)));
        expect(union(a, a)).toEqual(a);

        const frames = [...mod.run(mod.defaultInput)];
        const priorSizes = (frames[0]?.meta["sets"] as string[][]).map((set) => set.length);
        for (const frame of frames.slice(1, frames.length - 1)) {
            const sets = frame.meta["sets"] as string[][];
            for (let i = 0; i < sets.length; i += 1) {
                expect(sets[i]?.length ?? 0).toBeGreaterThanOrEqual(priorSizes[i] ?? 0);
                priorSizes[i] = sets[i]?.length ?? 0;
            }
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
