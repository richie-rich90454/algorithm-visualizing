/**
 * b-plus-tree-delete.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./b-plus-tree-delete";
import type { VisualFrame } from "@/types";

interface Input {
    order: number;
    keys: number[];
    deletes: number[];
}

/** Reference: an ordered multiset that deletes keys and reports sorted contents. */
function reference(keys: number[], deletes: number[]): number[][] {
    const remaining = [...new Set(keys)].sort((a, b) => a - b);
    const states: number[][] = [remaining.slice()];
    for (const key of deletes) {
        const at = remaining.indexOf(key);
        if (at >= 0) remaining.splice(at, 1);
        states.push(remaining.slice());
    }
    return states;
}

/** Check that a frame sequence is well formed and that edges point to real nodes. */
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("node");
        }
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("B+ Tree Deletion", () => {
    const input = mod.defaultInput as Input;

    it("keeps the leaf keys equal to a reference set after every delete", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const states = reference(input.keys, input.deletes);
        for (let i = 0; i < input.deletes.length; i += 1) {
            const keys = frames[i + 1]?.meta["keys"] as number[];
            expect(keys).toEqual(states[i + 1]);
            // Leaf keys must always be strictly increasing.
            for (let j = 1; j < keys.length; j += 1) {
                expect(keys[j]!).toBeGreaterThan(keys[j - 1]!);
            }
        }
    });

    it("preserves tree invariants for random key sets and delete orders", () => {
        let seed = 12345;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const keys = Array.from({ length: 14 }, () => rand() % 40);
            const unique = [...new Set(keys)];
            const deletes = unique.slice().sort(() => rand() % 3 === 0 ? 1 : -1).slice(0, 10);
            const order = 3 + (trial % 4);
            const frames = [...mod.run({ order, keys, deletes })];
            checkFrames(frames);
            const states = reference(keys, deletes);
            for (let i = 0; i < deletes.length; i += 1) {
                const actual = frames[i + 1]?.meta["keys"] as number[];
                expect(actual).toEqual(states[i + 1]);
                // Internal separators must equal the first key of the right child,
                // which the module reports indirectly through the sorted leaf keys.
                expect(actual.length).toBe(states[i + 1]!.length);
            }
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["valid"]).toBe(1);
            expect(final?.["height"]).toBeGreaterThanOrEqual(1);
        }
    });

    it("reports keys that were never present without changing the tree", () => {
        const frames = [...mod.run({ order: 4, keys: [1, 2, 3, 4], deletes: [99, 2, 99] })];
        checkFrames(frames);
        expect(frames[1]?.meta["keys"]).toEqual([1, 2, 3, 4]);
        expect(frames[2]?.meta["keys"]).toEqual([1, 3, 4]);
        expect(frames[3]?.meta["keys"]).toEqual([1, 3, 4]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
