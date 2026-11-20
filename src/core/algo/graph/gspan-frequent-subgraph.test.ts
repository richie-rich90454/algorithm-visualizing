/**
 * gspan-frequent-subgraph.test.ts - Independent brute-force support check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./gspan-frequent-subgraph";
import type { VisualFrame } from "@/types";

type Edge = [string, string];

/** Independent canonical form: minimal adjacency matrix over all vertex orders. */
function matrixKey(vertices: string[], edges: Edge[]): string {
    let best = "";
    const permute = (current: string[], remaining: string[]): void => {
        if (remaining.length === 0) {
            const rows: string[] = [];
            for (const a of current) {
                let row = "";
                for (const b of current) {
                    const linked = edges.some(
                        ([x, y]) => (x === a && y === b) || (x === b && y === a),
                    );
                    row += linked ? "1" : "0";
                }
                rows.push(row);
            }
            const key = rows.join("/");
            if (best === "" || key < best) best = key;
            return;
        }
        for (let i = 0; i < remaining.length; i += 1) {
            const label = remaining[i] as string;
            permute(
                [...current, label],
                remaining.filter((_, j) => j !== i),
            );
        }
    };
    permute([], vertices);
    return best;
}

function verticesOf(edges: Edge[]): string[] {
    const seen = new Set<string>();
    for (const [a, b] of edges) {
        seen.add(a);
        seen.add(b);
    }
    return [...seen];
}

function connected(vertices: string[], edges: Edge[]): boolean {
    if (vertices.length === 0) return false;
    const adjacency = new Map(vertices.map((v) => [v, new Set<string>()]));
    for (const [a, b] of edges) {
        adjacency.get(a)?.add(b);
        adjacency.get(b)?.add(a);
    }
    const seen = new Set<string>([vertices[0] as string]);
    const queue = [vertices[0] as string];
    while (queue.length > 0) {
        const node = queue.shift() as string;
        for (const next of adjacency.get(node) ?? []) {
            if (!seen.has(next)) {
                seen.add(next);
                queue.push(next);
            }
        }
    }
    return seen.size === vertices.length;
}

/** Brute-force reference via all edge subsets, canonicalized independently. */
function reference(graphs: Edge[][], minSupport: number, maxNodes: number): Set<string> {
    const support = new Map<string, number>();
    for (const graph of graphs) {
        const perGraph = new Set<string>();
        for (let mask = 1; mask < 1 << graph.length; mask += 1) {
            const edges: Edge[] = [];
            for (let i = 0; i < graph.length; i += 1) {
                if (mask & (1 << i)) edges.push(graph[i] as Edge);
            }
            const vertices = verticesOf(edges);
            if (vertices.length > maxNodes || !connected(vertices, edges)) continue;
            perGraph.add(matrixKey(vertices, edges));
        }
        for (const key of perGraph) support.set(key, (support.get(key) ?? 0) + 1);
    }
    return new Set([...support.entries()].filter(([, count]) => count >= minSupport).map(([key]) => key));
}

function moduleKeys(frames: VisualFrame[]): Set<string> {
    const patterns = frames[frames.length - 1]?.meta["patterns"] as Array<{ key: string }>;
    const result = new Set<string>();
    for (const pattern of patterns) {
        const edges: Edge[] = pattern.key === ""
            ? []
            : pattern.key.split(";").map((pair) => pair.split("-") as Edge);
        result.add(matrixKey(verticesOf(edges), edges));
    }
    return result;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
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

function seedFrom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("Frequent Subgraph Mining", () => {
    it("matches the brute-force support set on the default database", () => {
        const input = mod.defaultInput as { graphs: Edge[][]; minSupport: number; maxNodes: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        expect(moduleKeys(frames)).toEqual(reference(input.graphs, input.minSupport, input.maxNodes));
    });

    it("matches the brute-force reference across random graph databases", () => {
        const rand = seedFrom(99);
        for (let trial = 0; trial < 12; trial += 1) {
            const graphCount = 2 + Math.floor(rand() * 2);
            const graphs: Edge[][] = [];
            for (let g = 0; g < graphCount; g += 1) {
                const n = 3 + Math.floor(rand() * 2);
                const edges: Edge[] = [];
                for (let i = 0; i < n; i += 1) {
                    for (let j = i + 1; j < n; j += 1) {
                        if (rand() < 0.6) edges.push([`v${i}`, `v${j}`]);
                    }
                }
                if (edges.length === 0) edges.push(["v0", "v1"]);
                graphs.push(edges);
            }
            const minSupport = 2;
            const maxNodes = 3;
            const frames = [...mod.run({ graphs, minSupport, maxNodes })];
            checkFrames(frames);
            expect(moduleKeys(frames)).toEqual(reference(graphs, minSupport, maxNodes));
        }
    });

    it("terminates cleanly and handles an empty database", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);

        const empty = [...mod.run({ graphs: [] })];
        expect(empty.length).toBe(1);
        expect(empty[0]?.entities).toEqual([]);
    });
});
