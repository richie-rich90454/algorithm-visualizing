/**
 * b-tree-insert-split.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./b-tree-insert-split";
import type { VisualEntity, VisualFrame } from "@/types";

type BNode = { keys: number[]; leaf: boolean; depth: number; parentId: string };

function parseTree(frame: VisualFrame) {
    const nodes = new Map<string, BNode>();
    const children = new Map<string, string[]>();
    for (const entity of frame.entities) {
        const raw = String(entity.metadata["keys"] ?? "");
        nodes.set(entity.id, {
            keys: raw ? raw.split(",").map(Number) : [],
            leaf: entity.metadata["leaf"] === true,
            depth: Number(entity.metadata["depth"]),
            parentId: String(entity.metadata["parentId"]),
        });
        children.set(entity.id, []);
    }
    for (const edge of frame.edges) {
        expect(nodes.has(edge.sourceId)).toBe(true);
        expect(nodes.has(edge.targetId)).toBe(true);
        children.get(edge.sourceId)?.push(edge.targetId);
        expect(nodes.get(edge.targetId)?.parentId).toBe(edge.sourceId);
    }
    const root = [...nodes.keys()].find((id) => nodes.get(id)?.parentId === "root");
    expect(root).toBeDefined();
    return { nodes, children, root: root as string };
}

function inOrder(id: string, nodes: Map<string, BNode>, children: Map<string, string[]>): number[] {
    const node = nodes.get(id) as BNode;
    if (node.leaf) return [...node.keys];
    const result: number[] = [];
    const childIds = children.get(id) ?? [];
    for (let i = 0; i < childIds.length; i += 1) {
        result.push(...inOrder(childIds[i] as string, nodes, children));
        if (i < node.keys.length) result.push(node.keys[i] as number);
    }
    return result;
}

function range(id: string, nodes: Map<string, BNode>, children: Map<string, string[]>): [number, number] {
    const values = inOrder(id, nodes, children);
    return [values[0] as number, values[values.length - 1] as number];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e: VisualEntity) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
    });
}

function verifyTree(frame: VisualFrame, inputKeys: number[], order: number): void {
    const { nodes, children, root } = parseTree(frame);
    const expected = [...new Set(inputKeys)].sort((a, b) => a - b);
    expect(inOrder(root, nodes, children)).toEqual(expected);

    const leaves = [...nodes.entries()].filter(([, node]) => node.leaf);
    const depths = new Set(leaves.map(([, node]) => node.depth));
    expect(depths.size).toBe(1);

    const maxKeys = order - 1;
    const minKeys = Math.ceil(order / 2) - 1;
    for (const [id, node] of nodes) {
        const isRoot = id === root;
        if (!isRoot) expect(node.keys.length).toBeGreaterThanOrEqual(minKeys);
        expect(node.keys.length).toBeLessThanOrEqual(maxKeys);
        const sorted = [...node.keys].sort((a, b) => a - b);
        expect(node.keys).toEqual(sorted);

        const childIds = children.get(id) ?? [];
        expect(childIds.length).toBe(node.leaf ? 0 : node.keys.length + 1);
        for (let i = 0; i < childIds.length; i += 1) {
            const child = nodes.get(childIds[i] as string) as BNode;
            const [low, high] = range(childIds[i] as string, nodes, children);
            if (i > 0) expect(low).toBeGreaterThan(node.keys[i - 1] as number);
            if (i < node.keys.length) expect(high).toBeLessThan(node.keys[i] as number);
            expect(child.depth).toBe(node.depth + 1);
        }
    }
}

describe("B-Tree Insert and Split", () => {
    it("builds a valid order-four tree on the default keys", () => {
        const input = mod.defaultInput as { keys: number[]; order: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        verifyTree(frames[frames.length - 1] as VisualFrame, input.keys, input.order);
    });

    it("stays balanced through many splits of a small order", () => {
        const keys = Array.from({ length: 20 }, (_, i) => i + 1);
        const frames = [...mod.run({ keys, order: 3 })];
        checkFrames(frames);
        verifyTree(frames[frames.length - 1] as VisualFrame, keys, 3);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["split"]).toBe(false);
    });

    it("ignores duplicate keys", () => {
        const keys = [5, 5, 5, 1, 9, 1];
        const frames = [...mod.run({ keys, order: 4 })];
        checkFrames(frames);
        verifyTree(frames[frames.length - 1] as VisualFrame, keys, 4);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
