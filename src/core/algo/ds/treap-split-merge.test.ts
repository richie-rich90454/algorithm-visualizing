/**
 * treap-split-merge.test.ts - Treap invariants, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./treap-split-merge";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function finalMeta(frames: VisualFrame[]): { inorder: number[]; priorities: number[]; parents: number[] } {
    const m = frames[frames.length - 1]?.meta;
    return {
        inorder: m?.["inorder"] as number[],
        priorities: m?.["priorities"] as number[],
        parents: m?.["parents"] as number[],
    };
}

function verifyTreap(keys: number[], frames: VisualFrame[]): void {
    const { inorder, priorities, parents } = finalMeta(frames);
    expect(inorder.length).toBe(keys.length);
    expect([...inorder].sort((a, b) => a - b)).toEqual([...keys].sort((a, b) => a - b));
    const indexOf = new Map<number, number>();
    inorder.forEach((k, i) => indexOf.set(k, i));
    for (let i = 0; i < inorder.length; i += 1) {
        const parent = parents[i]!;
        if (parent !== -1) {
            const pi = indexOf.get(parent)!;
            expect(priorities[i]!).toBeLessThanOrEqual(priorities[pi]!);
        }
    }
}

describe("Treap split and merge", () => {
    it("produces a valid treap on the default keys", () => {
        const input = mod.defaultInput as { keys: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        verifyTreap(input.keys, frames);
    });

    it("keeps BST and heap invariants across random key orders", () => {
        let seed = 99;
        const rnd = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        for (let trial = 0; trial < 20; trial += 1) {
            const keys = Array.from({ length: 1 + Math.floor(rnd() * 9) }, (_, i) => i + 1);
            for (let i = keys.length - 1; i > 0; i -= 1) {
                const j = Math.floor(rnd() * (i + 1));
                const tmp = keys[i]!;
                keys[i] = keys[j]!;
                keys[j] = tmp;
            }
            const frames = [...mod.run({ keys })];
            verifyTreap(keys, frames);
        }
    });

    it("handles the empty case", () => {
        const frames = [...mod.run({ keys: [] })];
        checkFrames(frames);
        expect(finalMeta(frames).inorder).toEqual([]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
