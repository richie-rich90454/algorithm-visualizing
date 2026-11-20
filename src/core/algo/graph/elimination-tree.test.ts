/**
 * elimination-tree.test.ts - Definition-based parent check, tree-structure
 * property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./elimination-tree";
import type { VisualFrame } from "@/types";

type Adj = Record<string, string[]>;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((entity) => entity.id));
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

/** Parent by definition: smallest k>j adjacent to the component of j in G[0..j]. */
function parentsByDefinition(adjacency: Adj): number[] {
    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])].sort();
    const n = labels.length;
    const adj = labels.map((v) => new Set((adjacency[v] ?? []).map(String).filter((x) => x !== v)));
    const parent = Array<number>(n).fill(-1);
    for (let j = 0; j < n; j += 1) {
        const reachable = new Set<number>([j]);
        let changed = true;
        while (changed) {
            changed = false;
            for (const u of [...reachable]) {
                for (const label of adj[u] ?? []) {
                    const k = labels.indexOf(label);
                    if (k >= 0 && k <= j && !reachable.has(k)) {
                        reachable.add(k);
                        changed = true;
                    }
                }
            }
        }
        let best = -1;
        for (const u of reachable) {
            for (const label of adj[u] ?? []) {
                const k = labels.indexOf(label);
                if (k > j && (best === -1 || k < best)) {
                    best = k;
                }
            }
        }
        parent[j] = best;
    }
    return parent;
}

describe("Elimination Tree", () => {
    it("matches the definition on several graphs", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { graph: Adj }).graph,
            { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
            { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
            { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["A", "B", "C"] },
        ];
        for (const graph of graphs) {
            const frames = [...mod.run({ graph })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["parent"]).toEqual(parentsByDefinition(graph));
        }
    });

    it("produces a single rooted tree", () => {
        const graph = (mod.defaultInput as { graph: Adj }).graph;
        const frames = [...mod.run({ graph })];
        const parent = frames[frames.length - 1]?.meta["parent"] as number[];
        const roots = parent.filter((p) => p === -1).length;
        expect(roots).toBe(1);
        for (let i = 0; i < parent.length; i += 1) {
            expect(parent[i] === -1 || (parent[i] as number) > i).toBe(true);
        }
        expect(parent.filter((p) => p !== -1).length).toBe(parent.length - 1);
    });

    it("handles an empty graph and terminates", () => {
        const empty = [...mod.run({ graph: {} })];
        checkFrames(empty);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
