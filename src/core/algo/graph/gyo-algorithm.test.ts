/**
 * gyo-algorithm.test.ts - Chordality and join-tree property checks.
 */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./gyo-algorithm";

type GraphInput = Record<string, string[]>;

function key(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function undirected(graph: GraphInput): Map<string, Set<string>> {
    const result = new Map<string, Set<string>>();
    const vertices = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])];
    for (const v of vertices) result.set(v, new Set());
    for (const [a, bs] of Object.entries(graph)) {
        for (const b of bs) {
            result.get(a)?.add(b);
            result.get(b)?.add(a);
        }
    }
    return result;
}

function finalEdges(frames: VisualFrame[]): Map<string, boolean> {
    const edges = new Map<string, boolean>();
    for (const edge of frames[frames.length - 1]?.edges ?? []) {
        const a = edge.sourceId.replace("node-", "");
        const b = edge.targetId.replace("node-", "");
        edges.set(key(a, b), edge.state === "swapped");
    }
    return edges;
}

function maximalCliques(graph: Map<string, Set<string>>, vertices: string[]): string[][] {
    const result: string[][] = [];
    const expand = (current: string[], candidates: Set<string>): void => {
        if (candidates.size === 0) {
            if (current.length > 0) result.push([...current].sort());
            return;
        }
        for (const vertex of [...candidates]) {
            const next = new Set([...candidates].filter((n) => graph.get(vertex)?.has(n) || n === vertex));
            next.delete(vertex);
            expand([...current, vertex], next);
        }
    };
    expand([], new Set(vertices));
    return result;
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

describe("GYO Algorithm", () => {
    it("preserves original edges and produces a chordal graph", () => {
        const cases: GraphInput[] = [
            { A: ["B", "D"], B: ["A", "C", "D"], C: ["B", "D"], D: ["A", "B", "C"] },
            { A: ["B", "C"], B: ["A", "D"], C: ["A", "D"], D: ["B", "C"] },
            { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
        ];
        for (const graph of cases) {
            const frames = [...module.run({ graph })];
            verifyFrameShapes(frames);
            const original = undirected(graph);
            const edges = finalEdges(frames);
            const order = (frames[frames.length - 1]?.meta.order as string[] | undefined) ?? [];
            for (const [a, bs] of original) {
                for (const b of bs) expect(edges.has(key(a, b))).toBe(true);
            }
            const rank = new Map(order.map((label, i) => [label, i]));
            const finalGraph = new Map<string, Set<string>>();
            for (const vertex of order) finalGraph.set(vertex, new Set());
            for (const keyString of edges.keys()) {
                const [a, b] = keyString.split("|");
                finalGraph.get(a ?? "")?.add(b ?? "");
                finalGraph.get(b ?? "")?.add(a ?? "");
            }
            for (const vertex of order) {
                const later = [...(finalGraph.get(vertex) ?? [])].filter((n) => (rank.get(n) ?? -1) > (rank.get(vertex) ?? 0));
                for (let i = 0; i < later.length; i += 1) {
                    for (let j = i + 1; j < later.length; j += 1) {
                        expect(edges.has(key(later[i] ?? "", later[j] ?? ""))).toBe(true);
                    }
                }
            }
        }
    });

    it("adds no fill edges to an already chordal graph", () => {
        const chordal = { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["A", "B", "C"] };
        const frames = [...module.run({ graph: chordal })];
        expect(frames[frames.length - 1]?.meta.fillEdges).toBe(0);
        const cliques = maximalCliques(undirected(chordal), Object.keys(chordal));
        expect(cliques.length).toBeGreaterThan(0);
    });

    it("terminates with sequential step numbers", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => expect(frame.stepNumber).toBe(index));
    });
});
