/** extra-trees.test.ts - Reference randomized tree, leaf-mean property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./extra-trees";
import type { VisualFrame } from "@/types";

interface Input {
    xs: number[];
    ys: number[];
    thresholds: number[];
    maxDepth: number;
    minSize: number;
    queries: number[];
}

interface RefNode {
    indices: number[];
    threshold: number | null;
    prediction: number;
    isLeaf: boolean;
    left: RefNode | null;
    right: RefNode | null;
}

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((a, v) => a + v, 0) / values.length;
}

function reference(input: Input) {
    const make = (indices: number[]): RefNode => ({
        indices,
        threshold: null,
        prediction: mean(indices.map((i) => input.ys[i] ?? 0)),
        isLeaf: true,
        left: null,
        right: null,
    });
    const root = make(input.xs.map((_, i) => i));
    const queue: RefNode[] = [root];
    let t = 0;
    while (queue.length > 0) {
        const node = queue.shift()!;
        const depth = depthOf(root, node, 0);
        if (depth >= input.maxDepth || node.indices.length <= input.minSize) continue;
        const threshold = input.thresholds[t];
        t += 1;
        if (threshold === undefined) continue;
        const leftIdx = node.indices.filter((i) => (input.xs[i] ?? 0) <= threshold);
        const rightIdx = node.indices.filter((i) => (input.xs[i] ?? 0) > threshold);
        if (leftIdx.length === 0 || rightIdx.length === 0) continue;
        node.threshold = threshold;
        node.isLeaf = false;
        node.left = make(leftIdx);
        node.right = make(rightIdx);
        queue.push(node.left, node.right);
    }
    const predict = (q: number): number => {
        let node = root;
        while (!node.isLeaf && node.threshold !== null) {
            node = (q <= node.threshold ? node.left : node.right)!;
        }
        return node.prediction;
    };
    return { root, predictions: input.queries.map(predict) };
}

function depthOf(root: RefNode, target: RefNode, depth: number): number {
    if (root === target) return depth;
    if (root.left) {
        const l = depthOf(root.left, target, depth + 1);
        if (l >= 0) return l;
    }
    if (root.right) return depthOf(root.right, target, depth + 1);
    return -1;
}

function collectLeaves(node: RefNode, acc: RefNode[] = []): RefNode[] {
    if (node.isLeaf) acc.push(node);
    else {
        if (node.left) collectLeaves(node.left, acc);
        if (node.right) collectLeaves(node.right, acc);
    }
    return acc;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Extra-Trees", () => {
    it("matches an independently built randomized tree's predictions", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["predictions"]).toEqual(expected.predictions);
        expect(final?.["predictions"]).toEqual([0, 1, 0.5]);
    });

    it("leaf predictions equal independently computed label means", () => {
        const expected = reference(mod.defaultInput as Input);
        const frames = [...mod.run(mod.defaultInput)];
        const entities = frames[frames.length - 1]?.entities ?? [];
        const moduleLeaves = entities
            .filter((e) => e.metadata["isLeaf"] === true)
            .map((e) => e.value as number)
            .sort((a, b) => a - b);
        const refLeaves = collectLeaves(expected.root)
            .map((n) => n.prediction)
            .sort((a, b) => a - b);
        expect(moduleLeaves).toEqual(refLeaves);
    });

    it("emits a valid parent structure in the final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const entities = frames[frames.length - 1]?.entities ?? [];
        const ids = new Set(entities.map((e) => e.id));
        expect(ids.size).toBe(entities.length);
        for (const e of entities) {
            const parent = e.metadata["parentId"];
            if (typeof parent === "string" && parent !== "") expect(ids.has(parent)).toBe(true);
        }
        expect(frames[frames.length - 1]?.edges.length).toBe(entities.length - 1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
