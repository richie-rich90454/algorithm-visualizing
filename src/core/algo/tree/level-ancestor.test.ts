/**
 * level-ancestor.test.ts - Cross-check against parent-pointer walks.
 */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./level-ancestor";

function depthsOf(parents: number[]): number[] {
    const children: number[][] = parents.map(() => []);
    let root = -1;
    for (let i = 0; i < parents.length; i += 1) {
        const p = parents[i] ?? -1;
        if (p < 0 || p >= parents.length) root = i;
        else children[p]?.push(i);
    }
    const depths = new Array<number>(parents.length).fill(0);
    const queue = root >= 0 ? [root] : [];
    for (let head = 0; head < queue.length; head += 1) {
        const node = queue[head] ?? 0;
        for (const child of children[node] ?? []) {
            depths[child] = (depths[node] ?? 0) + 1;
            queue.push(child);
        }
    }
    return depths;
}

function bruteAncestor(parents: number[], node: number, targetDepth: number): number {
    const depths = depthsOf(parents);
    let current = node;
    while ((depths[current] ?? 0) > targetDepth && current >= 0) current = parents[current] ?? -1;
    return current;
}

function verifyFrameShapes(frames: VisualFrame[]): void {
    const lineCount = module.pseudocode?.length ?? 1;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lineCount);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) {
            expect(entity.type).toBe("node");
            expect(entity.metadata["parentId"]).toBeDefined();
        }
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) expect(ids.has(edge.targetId)).toBe(true);
    });
}

describe("Level Ancestor", () => {
    it("matches parent-pointer walks on random trees and queries", () => {
        for (let trial = 0; trial < 50; trial += 1) {
            const n = 1 + (trial % 15);
            const parents: number[] = [];
            for (let i = 0; i < n; i += 1) parents.push(i === 0 ? -1 : Math.floor(Math.random() * i));
            const depths = depthsOf(parents);
            const queries: Array<[number, number]> = [];
            for (let q = 0; q < 5; q += 1) {
                const node = Math.floor(Math.random() * n);
                queries.push([node, Math.floor(Math.random() * ((depths[node] ?? 0) + 1))]);
            }
            const frames = [...module.run({ parents, queries })];
            verifyFrameShapes(frames);
            const final = frames[frames.length - 1];
            const actual = final?.meta.answers as number[];
            expect(actual).toHaveLength(queries.length);
            queries.forEach(([node, depth], i) => expect(actual[i]).toBe(bruteAncestor(parents, node, depth)));
        }
    });

    it("handles the root, an empty tree, and a single node", () => {
        const single = [...module.run({ parents: [-1], queries: [[0, 0]] })];
        expect(single[single.length - 1]?.meta.answers).toEqual([0]);
        const empty = [...module.run({ parents: [], queries: [] })];
        expect(empty[empty.length - 1]?.meta.answers).toEqual([]);
        verifyFrameShapes(single);
        verifyFrameShapes(empty);
    });

    it("terminates with sequential step numbers", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((frame, index) => expect(frame.stepNumber).toBe(index));
    });
});
