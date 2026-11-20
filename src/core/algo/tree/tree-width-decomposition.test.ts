/**
 * tree-width-decomposition.test.ts - Independent elimination brute force,
 * decomposition validity, frame shape, and termination for exact treewidth.
 */

import { describe, expect, it } from "vitest";
import mod from "./tree-width-decomposition";

interface Graph {
    vertices: string[];
    edges: Array<[string, string]>;
}

/** Independent brute-force treewidth by trying every elimination order. */
function bruteTreewidth(graph: Graph): number {
    const vertices = graph.vertices;
    const permutations = (values: string[]): string[][] =>
        values.length <= 1
            ? [values]
            : values.flatMap((value, i) =>
                  permutations(values.filter((_, index) => index !== i)).map((tail) => [value, ...tail]),
              );
    let best = Infinity;
    for (const order of permutations(vertices)) {
        const adjacency = new Map<string, Set<string>>();
        for (const v of vertices) {
            adjacency.set(v, new Set());
        }
        for (const [a, b] of graph.edges) {
            adjacency.get(a)?.add(b);
            adjacency.get(b)?.add(a);
        }
        let width = vertices.length ? 0 : -1;
        for (const v of order) {
            const neighbors = [...(adjacency.get(v) ?? [])];
            width = Math.max(width, neighbors.length);
            for (const a of neighbors) {
                for (const b of neighbors) {
                    if (a !== b) {
                        adjacency.get(a)?.add(b);
                        adjacency.get(b)?.add(a);
                    }
                }
            }
            for (const neighbor of neighbors) {
                adjacency.get(neighbor)?.delete(v);
            }
            adjacency.get(v)?.clear();
        }
        best = Math.min(best, width);
    }
    return best === Infinity ? 0 : best;
}

function parseBags(encoded: string[]): string[][] {
    return encoded.map((value) => value.split(","));
}

describe("Tree-Width Decomposition", () => {
    it("finds an exact treewidth for the default tree", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const last = frames[frames.length - 1];
        const graph: Graph = {
            vertices: ["A", "B", "C", "D", "E", "F", "G"],
            edges: [["A", "B"], ["A", "C"], ["B", "D"], ["B", "E"], ["C", "F"], ["E", "G"]],
        };
        expect(last?.meta.treewidth).toBe(bruteTreewidth(graph));
        expect(last?.meta.treewidth).toBe(1);
    });

    it("matches brute force and produces valid bags on small graphs", () => {
        const cases: Graph[] = [
            { vertices: ["A"], edges: [] },
            { vertices: ["A", "B"], edges: [["A", "B"]] },
            { vertices: ["A", "B", "C"], edges: [["A", "B"], ["B", "C"]] },
            { vertices: ["A", "B", "C"], edges: [["A", "B"], ["B", "C"], ["A", "C"]] },
            {
                vertices: ["A", "B", "C", "D"],
                edges: [["A", "B"], ["B", "C"], ["C", "D"], ["D", "A"], ["A", "C"]],
            },
        ];
        for (const graph of cases) {
            const frames = [...mod.run(graph)];
            const last = frames[frames.length - 1];
            const treewidth = last?.meta.treewidth as number;
            expect(treewidth, JSON.stringify(graph)).toBe(bruteTreewidth(graph));
            const bags = parseBags(last?.meta.bags as string[]);
            expect(bags.length).toBe(graph.vertices.length);
            expect(Math.max(...bags.map((bag) => bag.length)) - 1).toBe(treewidth);
            for (const vertex of graph.vertices) {
                expect(bags.some((bag) => bag.includes(vertex)), `cover ${vertex}`).toBe(true);
            }
            for (const [a, b] of graph.edges) {
                expect(bags.some((bag) => bag.includes(a) && bag.includes(b)), `edge ${a}-${b}`).toBe(true);
            }
            // Running intersection: bags of each vertex form a connected subtree.
            const bagEdgePairs = (frames[frames.length - 1]?.edges ?? []).map((edge) => {
                const i = Number((edge.sourceId as string).slice(4));
                const j = Number((edge.targetId as string).slice(4));
                return [i, j] as [number, number];
            });
            const bagAdjacency = new Map<number, number[]>();
            bags.forEach((_, i) => bagAdjacency.set(i, []));
            for (const [i, j] of bagEdgePairs) {
                bagAdjacency.get(i)?.push(j);
                bagAdjacency.get(j)?.push(i);
            }
            for (const vertex of graph.vertices) {
                const indices = bags.map((bag, i) => (bag.includes(vertex) ? i : -1)).filter((i) => i >= 0);
                if (indices.length <= 1) {
                    continue;
                }
                const reached = new Set<number>([indices[0]]);
                const queue = [indices[0] as number];
                while (queue.length > 0) {
                    const current = queue.shift() as number;
                    for (const neighbor of bagAdjacency.get(current) ?? []) {
                        if (bags[neighbor]?.includes(vertex) && !reached.has(neighbor)) {
                            reached.add(neighbor);
                            queue.push(neighbor);
                        }
                    }
                }
                expect(reached.size, `connected bags for ${vertex}`).toBe(indices.length);
            }
        }
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(typeof frame.description).toBe("string");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber as number).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber as number).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("graph");
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.size).toBe(frame.entities.length);
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
            for (const e of frame.entities) {
                expect(Number.isFinite(e.x)).toBe(true);
                expect(Number.isFinite(e.y)).toBe(true);
            }
        });
    });

    it("handles an empty graph", () => {
        const frames = [...mod.run({ vertices: [], edges: [] })];
        expect(frames).toHaveLength(2);
        expect(frames[frames.length - 1]?.meta.treewidth).toBe(0);
        expect(frames[frames.length - 1]?.description.length).toBeGreaterThanOrEqual(10);
    });
});
