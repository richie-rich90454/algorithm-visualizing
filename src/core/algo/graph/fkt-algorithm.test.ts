/**
 * fkt-algorithm.test.ts - Brute-force minimum feedback vertex set check.
 */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./fkt-algorithm";

type GraphInput = Record<string, string[]>;

function edgesOf(graph: GraphInput): Array<[string, string]> {
    const edges: Array<[string, string]> = [];
    for (const [source, neighbors] of Object.entries(graph)) {
        for (const target of neighbors) {
            if (source < target) edges.push([source, target]);
            else if (source !== target && !graph[target]?.includes(source)) edges.push([source, target]);
        }
    }
    return edges;
}

function acyclic(vertices: string[], edges: Array<[string, string]>, removed: Set<string>): boolean {
    const adj = new Map<string, string[]>();
    for (const v of vertices) if (!removed.has(v)) adj.set(v, []);
    for (const [a, b] of edges) {
        if (removed.has(a) || removed.has(b)) continue;
        adj.get(a)?.push(b);
        adj.get(b)?.push(a);
    }
    const color = new Map<string, number>();
    const visit = (v: string, parent: string | null): boolean => {
        color.set(v, 1);
        for (const nb of adj.get(v) ?? []) {
            if (nb === parent) continue;
            if (color.get(nb) === 1) return false;
            if (!color.has(nb) && !visit(nb, v)) return false;
        }
        color.set(v, 2);
        return true;
    };
    for (const v of vertices) {
        if (!removed.has(v) && !color.has(v) && !visit(v, null)) return false;
    }
    return true;
}

function bruteMinimum(vertices: string[], edges: Array<[string, string]>): number {
    for (let size = 0; size <= vertices.length; size += 1) {
        const chosen: string[] = [];
        const search = (start: number): boolean => {
            if (chosen.length === size) return acyclic(vertices, edges, new Set(chosen));
            for (let i = start; i < vertices.length; i += 1) {
                chosen.push(vertices[i] ?? "");
                if (search(i + 1)) return true;
                chosen.pop();
            }
            return false;
        };
        if (search(0)) return size;
    }
    return vertices.length;
}

function verifyFrameShapes(frames: VisualFrame[]): void {
    const lineCount = module.pseudocode?.length ?? 1;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lineCount);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("FKT Feedback Vertex Set Algorithm", () => {
    it("finds a minimum set on random small graphs", () => {
        const names = ["A", "B", "C", "D", "E", "F"];
        for (let trial = 0; trial < 40; trial += 1) {
            const n = 3 + (trial % 4);
            const vertices = names.slice(0, n);
            const graph: GraphInput = {};
            for (const v of vertices) graph[v] = [];
            for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                    if (Math.random() < 0.45) {
                        graph[vertices[i] ?? ""]?.push(vertices[j] ?? "");
                        graph[vertices[j] ?? ""]?.push(vertices[i] ?? "");
                    }
                }
            }
            const frames = [...module.run({ graph })];
            verifyFrameShapes(frames);
            const final = frames[frames.length - 1];
            expect(final).toBeDefined();
            expect(final?.meta.size).toBe(bruteMinimum(vertices, edgesOf(graph)));
            const chosen = (final?.meta.chosen as string[] | undefined) ?? [];
            expect(acyclic(vertices, edgesOf(graph), new Set(chosen))).toBe(true);
        }
    });

    it("handles an acyclic graph and an empty graph", () => {
        const path = [...module.run({ graph: { A: ["B"], B: ["A", "C"], C: ["B"] } })];
        expect(path[path.length - 1]?.meta.size).toBe(0);
        const empty = [...module.run({ graph: {} })];
        expect(empty[empty.length - 1]?.meta.size).toBe(0);
        verifyFrameShapes(path);
        verifyFrameShapes(empty);
    });

    it("terminates with sequential step numbers", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => expect(frame.stepNumber).toBe(index));
    });
});
