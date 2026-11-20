/**
 * avl-deletion-rebalance.test.ts - Correctness, frame, and termination tests.
 */

import { describe, expect, it } from "vitest";
import mod from "./avl-deletion-rebalance";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function expectedInorder(values: number[], deletions: number[]): number[] {
    const removed = new Set(deletions);
    return [...new Set(values)].filter((v) => !removed.has(v)).sort((a, b) => a - b);
}

/** A lower bound is not needed; assert the reported height is a sane AVL height. */
function heightBound(n: number): number {
    if (n === 0) {
        return 0;
    }
    return Math.ceil(1.45 * Math.log2(n + 2)) + 1;
}

describe("AVL Deletion and Rebalancing", () => {
    it("matches the default input oracle and stays balanced", () => {
        const input = mod.defaultInput as { values: number[]; deletions: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["inorder"]).toEqual(expectedInorder(input.values, input.deletions));
        expect(final?.["balanced"]).toBe(true);
        // Every intermediate frame must report a valid tree.
        for (const frame of frames) {
            expect(frame.meta["balanced"]).toBe(true);
        }
    });

    it("keeps the AVL invariants across random insert/delete sequences", () => {
        let seed = 4242;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 80; trial += 1) {
            const count = 1 + (rand() % 24);
            const values: number[] = [];
            for (let k = 0; k < count; k += 1) {
                values.push(rand() % 80);
            }
            const deletions: number[] = [];
            const deleteCount = rand() % (count + 3);
            for (let k = 0; k < deleteCount; k += 1) {
                deletions.push(rand() % 80);
            }
            const frames = [...mod.run({ values, deletions })];
            checkFrames(frames);
            for (const frame of frames) {
                expect(frame.meta["balanced"]).toBe(true);
            }
            const final = frames[frames.length - 1]?.meta;
            const expected = expectedInorder(values, deletions);
            expect(final?.["inorder"]).toEqual(expected);
            expect(Number(final?.["height"])).toBeLessThanOrEqual(heightBound(expected.length));
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
