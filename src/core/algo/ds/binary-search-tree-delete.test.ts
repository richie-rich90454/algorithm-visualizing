/**
 * binary-search-tree-delete.test.ts - Correctness, frame, and termination tests.
 */

import { describe, expect, it } from "vitest";
import mod from "./binary-search-tree-delete";
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

/** The expected result: original unique keys minus the deleted keys, sorted. */
function expectedInorder(values: number[], deletions: number[]): number[] {
    const removed = new Set(deletions);
    return [...new Set(values)].filter((v) => !removed.has(v)).sort((a, b) => a - b);
}

describe("Binary Search Tree Delete", () => {
    it("matches the default input oracle", () => {
        const input = mod.defaultInput as { values: number[]; deletions: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta["inorder"] as number[];
        expect(final).toEqual(expectedInorder(input.values, input.deletions));
    });

    it("matches brute-force sets on random insert/delete sequences", () => {
        let seed = 991;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 80; trial += 1) {
            const count = 1 + (rand() % 20);
            const values: number[] = [];
            for (let k = 0; k < count; k += 1) {
                values.push(rand() % 60);
            }
            const deletions: number[] = [];
            const deleteCount = rand() % (count + 3);
            for (let k = 0; k < deleteCount; k += 1) {
                deletions.push(rand() % 60);
            }
            const frames = [...mod.run({ values, deletions })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta["inorder"] as number[];
            expect(final).toEqual(expectedInorder(values, deletions));
            // Inorder must be strictly increasing (valid BST ordering).
            for (let k = 1; k < final.length; k += 1) {
                expect(final[k]!).toBeGreaterThan(final[k - 1]!);
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
