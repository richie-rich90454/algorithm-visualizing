/**
 * minimum-ratio-spanning-tree.test.ts - Exhaustive spanning-tree check, frames, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./minimum-ratio-spanning-tree";
import type { VisualFrame } from "@/types";

type Edge = [number, number, number, number];

/** Enumerate every n-1 edge subset, keep spanning trees, return the best ratio. */
function bruteRatio(nodes: number, edges: Edge[]): number {
    let best = Number.POSITIVE_INFINITY;
    const pick = (start: number, chosen: Edge[]) => {
        if (chosen.length === nodes - 1) {
            const parent = Array.from({ length: nodes }, (_, i) => i);
            const root = (x: number): number => (parent[x] === x ? x : root(parent[x]));
            for (const [u, v] of chosen) parent[root(u)] = root(v);
            const first = root(0);
            for (let i = 1; i < nodes; i += 1) if (root(i) !== first) return;
            const cost = chosen.reduce((s, e) => s + e[2], 0);
            const weight = chosen.reduce((s, e) => s + e[3], 0);
            best = Math.min(best, cost / weight);
            return;
        }
        for (let i = start; i < edges.length; i += 1) {
            const edge = edges[i];
            if (edge) pick(i + 1, [...chosen, edge]);
        }
    };
    pick(0, []);
    return best;
}

function checkFrames(frames: VisualFrame[], nodes: number, edgeCount: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodes);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(edgeCount);
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

describe("Minimum Ratio Spanning Tree", () => {
    it("matches exhaustive enumeration on small graphs", () => {
        const cases: Array<{ nodes: number; edges: Edge[] }> = [
            {
                nodes: 4,
                edges: [[0, 1, 4, 1], [0, 2, 1, 2], [1, 2, 2, 1], [1, 3, 5, 2], [2, 3, 3, 3]],
            },
            {
                nodes: 3,
                edges: [[0, 1, 2, 1], [0, 2, 1, 3], [1, 2, 4, 2]],
            },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.nodes, input.edges.length);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["answer"])).toBeCloseTo(bruteRatio(input.nodes, input.edges), 5);
            const chosen = final?.["bestEdges"] as number[];
            expect(chosen.length).toBe(input.nodes - 1);
            let cost = 0;
            let weight = 0;
            for (const index of chosen) {
                cost += input.edges[index][2];
                weight += input.edges[index][3];
            }
            expect(cost / weight).toBeCloseTo(Number(final?.["answer"]), 5);
        }
    });

    it("reports ratio one on the default graph", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(Number(frames[frames.length - 1]?.meta["answer"])).toBeCloseTo(1, 5);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
