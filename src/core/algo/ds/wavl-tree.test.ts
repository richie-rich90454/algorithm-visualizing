/** wavl-tree.test.ts - Rank-balance invariant, BST order, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./wavl-tree";
import type { VisualFrame, VisualEntity } from "@/types";

type WNode = { value: number; rank: number; balance: number; left?: WNode; right?: WNode };

function readTree(frame: VisualFrame): WNode | null {
    const map = new Map<string, WNode>();
    for (const entity of frame.entities) {
        if (entity.id === "empty") continue;
        map.set(entity.id, {
            value: Number(entity.value),
            rank: Number(entity.metadata["rank"]),
            balance: Number(entity.metadata["balance"]),
        });
    }
    for (const edge of frame.edges) {
        const parent = map.get(edge.sourceId);
        const child = map.get(edge.targetId);
        if (parent && child) {
            if (edge.label === "L") parent.left = child;
            if (edge.label === "R") parent.right = child;
        }
    }
    const targets = new Set(frame.edges.map((e) => e.targetId));
    const rootEntity: VisualEntity | undefined = frame.entities.find((e) => e.id !== "empty" && !targets.has(e.id));
    return rootEntity ? (map.get(rootEntity.id) ?? null) : null;
}

function inorder(node: WNode | null | undefined, out: number[] = []): number[] {
    if (!node) return out;
    inorder(node.left, out);
    out.push(node.value);
    inorder(node.right, out);
    return out;
}

function checkInvariants(node: WNode | null | undefined, low: number, high: number): void {
    if (!node) return;
    expect(node.value).toBeGreaterThan(low);
    expect(node.value).toBeLessThan(high);
    const leftRank = node.left?.rank ?? 0;
    const rightRank = node.right?.rank ?? 0;
    expect(node.rank).toBe(1 + Math.max(leftRank, rightRank));
    expect(Math.abs(node.balance)).toBeLessThanOrEqual(2);
    checkInvariants(node.left, low, node.value);
    checkInvariants(node.right, node.value, high);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("WAVL Tree", () => {
    it("preserves BST order and the rank-balance invariant", () => {
        const input = mod.defaultInput as { inserts: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const tree = readTree(frames[frames.length - 1] as VisualFrame);
        expect(inorder(tree)).toEqual([...input.inserts].sort((a, b) => a - b));
        checkInvariants(tree, -Infinity, Infinity);
    });

    it("keeps invariants on ascending and shuffled inputs", () => {
        for (const inserts of [[1, 2, 3, 4, 5, 6, 7, 8], [50, 10, 90, 30, 70, 20, 80]]) {
            const frames = [...mod.run({ inserts })];
            const tree = readTree(frames[frames.length - 1] as VisualFrame);
            expect(inorder(tree)).toEqual([...inserts].sort((a, b) => a - b));
            checkInvariants(tree, -Infinity, Infinity);
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
