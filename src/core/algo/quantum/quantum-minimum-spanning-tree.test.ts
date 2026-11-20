/**
 * quantum-minimum-spanning-tree.test.ts - MST optimality and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { kruskalMst, quantumMst } from "./quantum-minimum-spanning-tree";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent exhaustive subset search for the minimum spanning tree weight. */
function bruteMstWeight(n: number, edges: Array<[number, number, number]>): number {
    let best = Number.POSITIVE_INFINITY;
    const visit = (chosen: number[], weight: number, index: number) => {
        if (chosen.length === n - 1) {
            best = Math.min(best, weight);
            return;
        }
        if (index >= edges.length) {
            return;
        }
        const parent = Array.from({ length: n }, (_, i) => i);
        const find = (x: number): number => {
            while (parent[x] !== x) {
                x = parent[x] as number;
            }
            return x;
        };
        for (const i of chosen) {
            const edge = edges[i] as [number, number, number];
            parent[find(edge[0])] = find(edge[1]);
        }
        const edge = edges[index] as [number, number, number];
        if (find(edge[0]) !== find(edge[1])) {
            visit([...chosen, index], weight + edge[2], index + 1);
        }
        visit(chosen, weight, index + 1);
    };
    visit([], 0, 0);
    return best;
}

describe("Quantum Minimum Spanning Tree", () => {
    it("matches Kruskal and an exhaustive subset search on several graphs", () => {
        const graphs: Array<{ n: number; edges: Array<[number, number, number]> }> = [
            { n: 4, edges: [[0, 1, 1], [0, 2, 5], [1, 2, 2], [2, 3, 3], [1, 3, 7]] },
            { n: 5, edges: [[0, 1, 2], [0, 2, 4], [1, 2, 1], [1, 3, 7], [2, 3, 3], [2, 4, 5], [3, 4, 2]] },
            { n: 3, edges: [[0, 1, 6], [0, 2, 2], [1, 2, 4]] },
        ];
        for (const graph of graphs) {
            const quantum = quantumMst(graph.n, graph.edges);
            const kruskal = kruskalMst(graph.n, graph.edges);
            expect(quantum.weight).toBe(kruskal.weight);
            expect(quantum.weight).toBe(bruteMstWeight(graph.n, graph.edges));
            expect(quantum.selected).toHaveLength(graph.n - 1);
        }
    });

    it("reports an optimal tree in the final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["optimal"]).toBe(true);
        expect(Number(final?.["weight"])).toBe(Number(final?.["referenceWeight"]));
        expect(Number(final?.["queries"])).toBeGreaterThan(0);
        const selected = final?.["selected"] as number[];
        expect(selected).toHaveLength(4);
    });

    it("handles a graph with a single obvious spanning tree", () => {
        const edges: Array<[number, number, number]> = [[0, 1, 1], [1, 2, 1], [2, 3, 1]];
        const result = quantumMst(4, edges);
        expect(result.weight).toBe(3);
        expect(result.selected).toEqual([0, 1, 2]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
