/**
 * minimum-height-tree-dp.test.ts - Brute force root heights, frames, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./minimum-height-tree-dp";
import type { VisualFrame } from "@/types";

type Edge = [number, number];

/** Reference: root at every vertex, take the maximum BFS distance. */
function bruteCenters(edges: Edge[]): { centers: number[]; answer: number } {
    const nodes = new Set<number>();
    const adjacency = new Map<number, number[]>();
    for (const [u, v] of edges) {
        nodes.add(u);
        nodes.add(v);
        if (!adjacency.has(u)) adjacency.set(u, []);
        if (!adjacency.has(v)) adjacency.set(v, []);
        adjacency.get(u)?.push(v);
        adjacency.get(v)?.push(u);
    }
    const heights = new Map<number, number>();
    for (const root of nodes) {
        const dist = new Map<number, number>([[root, 0]]);
        const queue = [root];
        let best = 0;
        while (queue.length > 0) {
            const u = queue.shift();
            if (u === undefined) continue;
            for (const v of adjacency.get(u) ?? []) {
                if (!dist.has(v)) {
                    const d = (dist.get(u) ?? 0) + 1;
                    dist.set(v, d);
                    best = Math.max(best, d);
                    queue.push(v);
                }
            }
        }
        heights.set(root, best);
    }
    const min = Math.min(...heights.values());
    return {
        centers: [...heights.entries()].filter(([, h]) => h === min).map(([n]) => n).sort((a, b) => a - b),
        answer: min,
    };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
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

describe("Minimum Height Tree", () => {
    it("matches brute force root heights on several trees", () => {
        const cases: Edge[][] = [
            [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]],
            [[0, 1], [1, 2], [2, 3]],
            [[0, 1], [0, 2]],
            [[0, 1], [0, 2], [0, 3], [3, 4], [3, 5]],
        ];
        for (const edges of cases) {
            const frames = [...mod.run({ edges })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = bruteCenters(edges);
            expect(final?.["centers"]).toEqual(expected.centers);
            expect(final?.["answer"]).toBe(expected.answer);
        }
    });

    it("finds center zero on the default tree", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["centers"]).toEqual([0]);
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(2);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
