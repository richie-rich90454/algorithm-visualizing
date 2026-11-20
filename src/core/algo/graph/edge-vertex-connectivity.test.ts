/**
 * edge-vertex-connectivity.test.ts - Brute-force cross-checks.
 */

import { describe, expect, it } from "vitest";
import conn from "./edge-vertex-connectivity";

type Graph = Record<string, string[]>;

function normalize(g: Graph): Graph {
    const out: Graph = {};
    for (const v of Object.keys(g)) {
        out[v] = [];
    }
    for (const [u, ns] of Object.entries(g)) {
        for (const v of ns) {
            out[u] ??= [];
            out[v] ??= [];
            if (!out[u].includes(v)) {
                out[u].push(v);
            }
            if (!out[v].includes(u)) {
                out[v].push(u);
            }
        }
    }
    return out;
}

function edgeList(g: Graph): Array<[string, string]> {
    const seen = new Set<string>();
    const out: Array<[string, string]> = [];
    for (const [u, ns] of Object.entries(g)) {
        for (const v of ns) {
            const k = [u, v].sort().join("|");
            if (!seen.has(k)) {
                seen.add(k);
                out.push([u, v]);
            }
        }
    }
    return out;
}

function components(vertices: string[], edges: Array<[string, string]>, removed: Set<string>): number {
    const present = vertices.filter((v) => !removed.has(v));
    if (present.length === 0) {
        return 0;
    }
    const adj = new Map<string, string[]>(present.map((v) => [v, []]));
    for (const [u, v] of edges) {
        if (removed.has(u) || removed.has(v)) {
            continue;
        }
        adj.get(u)?.push(v);
        adj.get(v)?.push(u);
    }
    const seen = new Set<string>();
    let count = 0;
    for (const start of present) {
        if (seen.has(start)) {
            continue;
        }
        count += 1;
        const stack = [start];
        seen.add(start);
        while (stack.length) {
            const u = stack.pop() as string;
            for (const v of adj.get(u) ?? []) {
                if (!seen.has(v)) {
                    seen.add(v);
                    stack.push(v);
                }
            }
        }
    }
    return count;
}

function bruteEdgeConnectivity(graph: Graph): number {
    const g = normalize(graph);
    const vertices = Object.keys(g);
    const edges = edgeList(g);
    for (let k = 0; k <= edges.length; k += 1) {
        // enumerate edge subsets of size k
        const choose = (start: number, picked: number[]): boolean => {
            if (picked.length === k) {
                const remaining = edges.filter((_, i) => !picked.includes(i));
                return components(vertices, remaining, new Set()) > 1;
            }
            for (let i = start; i < edges.length; i += 1) {
                picked.push(i);
                if (choose(i + 1, picked)) {
                    return true;
                }
                picked.pop();
            }
            return false;
        };
        if (choose(0, [])) {
            return k;
        }
    }
    return edges.length;
}

function bruteVertexConnectivity(graph: Graph): number {
    const g = normalize(graph);
    const vertices = Object.keys(g);
    const edges = edgeList(g);
    for (let k = 0; k < vertices.length; k += 1) {
        const choose = (start: number, picked: string[]): boolean => {
            if (picked.length === k) {
                const removed = new Set(picked);
                const presentCount = vertices.length - k;
                return presentCount <= 1 || components(vertices, edges, removed) > 1;
            }
            for (let i = start; i < vertices.length; i += 1) {
                picked.push(vertices[i] as string);
                if (choose(i + 1, picked)) {
                    return true;
                }
                picked.pop();
            }
            return false;
        };
        if (choose(0, [])) {
            return k;
        }
    }
    return vertices.length - 1;
}

describe("EdgeVertexConnectivity", () => {
    const graphs: Graph[] = [
        { A: ["B", "C"], B: ["C", "D"], C: ["D"], D: ["E"], E: ["F"], F: [] },
        { A: ["B", "C"], B: ["C"], C: [] }, // triangle
        { A: ["B"], B: ["C"], C: ["D"], D: [] }, // path
        { A: ["B", "C", "D"], B: ["C", "D"], C: ["D"], D: [] }, // K4
        { A: ["B", "C"], B: ["C"], C: [], D: ["E"], E: [] }, // disconnected
        { A: ["B"], B: [], C: ["D"], D: [] }, // two edges
    ];

    it("matches brute-force minimum edge cuts", () => {
        for (const graph of graphs) {
            const frames = [...conn.run({ graph })];
            const got = frames.at(-1)?.meta.edgeConnectivity;
            expect(got, JSON.stringify(graph)).toBe(bruteEdgeConnectivity(graph));
        }
    });

    it("matches brute-force minimum vertex cuts", () => {
        for (const graph of graphs) {
            const frames = [...conn.run({ graph })];
            const got = frames.at(-1)?.meta.vertexConnectivity;
            expect(got, JSON.stringify(graph)).toBe(bruteVertexConnectivity(graph));
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...conn.run(conn.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        for (let i = 0; i < frames.length; i += 1) {
            const frame = frames[i];
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.layout).toBe("graph");
            expect(typeof frame.meta).toBe("object");
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(conn.pseudocode?.length ?? 0);
            for (const edge of frame.edges) {
                expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
                expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
            }
        }
    });
});
