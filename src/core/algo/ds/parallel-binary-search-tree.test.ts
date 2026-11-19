/** parallel-binary-search-tree.test.ts - BST validity cross-check, inorder check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./parallel-binary-search-tree";
import type { VisualFrame, VisualEntity } from "@/types";

type TNode = { value: number; left?: TNode; right?: TNode };

function readTree(frame: VisualFrame): TNode | null {
    const map = new Map<string, TNode>();
    for (const entity of frame.entities) {
        if (entity.id === "empty") continue;
        map.set(entity.id, { value: Number(entity.value) });
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

function inorder(node: TNode | null | undefined, out: number[] = []): number[] {
    if (!node) return out;
    inorder(node.left, out);
    out.push(node.value);
    inorder(node.right, out);
    return out;
}

function checkValid(node: TNode | null | undefined, low: number, high: number): void {
    if (!node) return;
    expect(node.value).toBeGreaterThanOrEqual(low);
    expect(node.value).toBeLessThanOrEqual(high);
    if (node.left) checkValid(node.left, low, node.value);
    if (node.right) checkValid(node.right, node.value, high);
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

describe("Parallel BST Construction", () => {
    it("builds a valid balanced BST containing the sorted keys", () => {
        const input = mod.defaultInput as { values: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const tree = readTree(frames[frames.length - 1] as VisualFrame);
        const expected = [...new Set(input.values)].sort((a, b) => a - b);
        expect(inorder(tree)).toEqual(expected);
        checkValid(tree, -Infinity, Infinity);
    });

    it("handles duplicates and single values", () => {
        for (const values of [[3, 3, 3], [9], [5, 1, 4, 2, 8]]) {
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const tree = readTree(frames[frames.length - 1] as VisualFrame);
            expect(inorder(tree)).toEqual([...new Set(values)].sort((a, b) => a - b));
            checkValid(tree, -Infinity, Infinity);
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
