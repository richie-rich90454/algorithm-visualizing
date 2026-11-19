/**
 * morris-preorder-traversal.test.ts - Correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./morris-preorder-traversal";
import type { VisualFrame } from "@/types";

interface TreeInput {
    ids: string[];
    left: Record<string, string | null>;
    right: Record<string, string | null>;
}

/** Independent recursive reference for preorder. */
function referencePreorder(tree: TreeInput): string[] {
    const L = new Map(Object.entries(tree.left));
    const R = new Map(Object.entries(tree.right));
    const isChild = new Set<string>();
    for (const id of tree.ids) {
        for (const c of [L.get(id), R.get(id)]) if (c) isChild.add(c);
    }
    const root = tree.ids.find((id) => !isChild.has(id)) ?? tree.ids[0];
    const out: string[] = [];
    const walk = (id: string | null | undefined): void => {
        if (!id || !tree.ids.includes(id)) return;
        out.push(id);
        walk(L.get(id));
        walk(R.get(id));
    };
    walk(root);
    return out;
}

/** Deterministic pseudo-random binary trees for property checks. */
function makeTrees(): TreeInput[] {
    let seed = 12345;
    const rnd = (): number => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };
    const trees: TreeInput[] = [];
    for (let trial = 0; trial < 20; trial += 1) {
        const n = 3 + Math.floor(rnd() * 8);
        const ids = Array.from({ length: n }, (_, i) => `n${i}`);
        const left: Record<string, string | null> = {};
        const right: Record<string, string | null> = {};
        for (const id of ids) {
            left[id] = null;
            right[id] = null;
        }
        for (let i = 1; i < n; i += 1) {
            // Only attach to a parent with a free slot so every node stays reachable.
            const eligible = ids.slice(0, i).filter((id) => !left[id] || !right[id]);
            const parent = eligible[Math.floor(rnd() * eligible.length)]!;
            const available: Array<"left" | "right"> = [];
            if (!left[parent]) available.push("left");
            if (!right[parent]) available.push("right");
            const side = available[Math.floor(rnd() * available.length)]!;
            (side === "left" ? left : right)[parent] = ids[i]!;
        }
        trees.push({ ids, left, right });
    }
    return trees;
}

function checkFrames(frames: VisualFrame[], expectedNodes: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.entities.length).toBe(expectedNodes);
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

describe("Morris preorder traversal", () => {
    it("matches an independent recursive preorder on the default tree", () => {
        const input = mod.defaultInput as TreeInput;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.ids.length);
        const final = frames[frames.length - 1]?.meta["preorder"];
        expect(final).toEqual(referencePreorder(input));
        expect(frames[frames.length - 1]?.meta["threadsRemaining"]).toBe(0);
    });

    it("matches recursive preorder on many generated trees", () => {
        for (const tree of makeTrees()) {
            const frames = [...mod.run(tree)];
            const final = frames[frames.length - 1]?.meta["preorder"];
            expect(final).toEqual(referencePreorder(tree));
            expect((final as string[]).length).toBe(tree.ids.length);
        }
    });

    it("handles an empty tree and a single node", () => {
        const empty = [...mod.run({ ids: [], left: {}, right: {} })];
        expect(empty[0]?.meta["preorder"]).toEqual([]);
        const single = [...mod.run({ ids: ["A"], left: { A: null }, right: { A: null } })];
        expect(single[single.length - 1]?.meta["preorder"]).toEqual(["A"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
