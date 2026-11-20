/** eppstein-k-shortest.test.ts - brute-force k-shortest cross-check, path properties, frame shape, termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod, { eppsteinKShortest } from "./eppstein-k-shortest";

type Adjacency = Record<string, Array<[string, number]>>;
const input = mod.defaultInput as { graph: Adjacency; start: string; target: string; k: number };

/** Reference: enumerate every simple source-to-target path by DFS, then sort by cost. */
function bruteForce(
    graph: Adjacency,
    start: string,
    target: string,
): Array<{ cost: number; vertices: string[] }> {
    const found: Array<{ cost: number; vertices: string[] }> = [];
    const seen = new Set<string>();
    const visited = new Set<string>([start]);
    const path = [start];
    const dfs = (at: string, cost: number): void => {
        if (at === target) {
            const key = path.join(">");
            if (!seen.has(key)) {
                seen.add(key);
                found.push({ cost, vertices: [...path] });
            }
            return;
        }
        for (const [next, weight] of graph[at] ?? []) {
            if (visited.has(next)) continue;
            visited.add(next);
            path.push(next);
            dfs(next, cost + weight);
            path.pop();
            visited.delete(next);
        }
    };
    dfs(start, 0);
    found.sort((a, b) => a.cost - b.cost || a.vertices.join(">").localeCompare(b.vertices.join(">")));
    return found;
}

function edgeWeight(graph: Adjacency, a: string, b: string): number | undefined {
    return (graph[a] ?? []).find(([to]) => to === b)?.[1];
}

function checkFrames(frames: VisualFrame[], vertexCount: number, edgeCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(vertexCount);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(edgeCount);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

const vertexCount = (graph: Adjacency): number =>
    new Set([...Object.keys(graph), ...Object.values(graph).flatMap((l) => l.map((e) => e[0]))]).size;
const edgeCount = (graph: Adjacency): number =>
    Object.values(graph).reduce((sum, list) => sum + list.length, 0);

describe("Eppstein's K Shortest Paths", () => {
    it("matches brute-force k shortest costs on the default graph", () => {
        const expected = bruteForce(input.graph, input.start, input.target)
            .slice(0, input.k)
            .map((p) => p.cost);
        const actual = eppsteinKShortest(input.graph, input.start, input.target, input.k).map(
            (p) => p.cost,
        );
        expect(expected).toEqual([5, 5, 6]);
        expect(actual).toEqual(expected);
    });

    it("reports valid loopless paths whose edge weights sum to the reported cost", () => {
        const results = eppsteinKShortest(input.graph, input.start, input.target, 8);
        expect(results.length).toBeGreaterThan(1);
        for (const result of results) {
            expect(result.vertices[0]).toBe(input.start);
            expect(result.vertices[result.vertices.length - 1]).toBe(input.target);
            expect(new Set(result.vertices).size).toBe(result.vertices.length);
            let sum = 0;
            for (let i = 0; i + 1 < result.vertices.length; i += 1) {
                const weight = edgeWeight(input.graph, result.vertices[i] as string, result.vertices[i + 1] as string);
                expect(weight).toBeDefined();
                sum += weight as number;
            }
            expect(sum).toBe(result.cost);
        }
        for (let i = 1; i < results.length; i += 1) {
            expect((results[i] as { cost: number }).cost).toBeGreaterThanOrEqual(
                (results[i - 1] as { cost: number }).cost,
            );
        }
    });

    it("matches brute force on many seeded small graphs for several k values", () => {
        let seed = 1234567;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        for (let trial = 0; trial < 24; trial += 1) {
            const n = 5 + (trial % 2);
            const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
            const graph: Adjacency = {};
            for (const label of labels) graph[label] = [];
            for (let i = 0; i < n; i += 1) {
                for (let j = 0; j < n; j += 1) {
                    if (i === j || rand() > 0.45) continue;
                    (graph[labels[i] as string] as Array<[string, number]>).push([
                        labels[j] as string,
                        1 + Math.floor(rand() * 6),
                    ]);
                }
            }
            const start = labels[0] as string;
            const target = labels[n - 1] as string;
            const expectedAll = bruteForce(graph, start, target).map((p) => p.cost);
            for (const k of [1, 2, 3, 5]) {
                const actual = eppsteinKShortest(graph, start, target, k).map((p) => p.cost);
                expect(actual).toEqual(expectedAll.slice(0, k));
                expect(actual).toHaveLength(Math.min(k, expectedAll.length));
            }
        }
    });

    it("emits well-formed frames and reports the same costs in meta", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, vertexCount(input.graph), edgeCount(input.graph));
        const reported = frames.at(-1)?.meta["costs"] as number[];
        expect(reported).toEqual([5, 5, 6]);
        expect(frames.at(-1)?.meta["distance"]).toBe(5);
    });

    it("terminates cleanly and handles an unreachable target", () => {
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);

        const disconnected: Adjacency = { ...input.graph, E: [], Z: [] };
        delete disconnected["D"];
        const result = eppsteinKShortest(disconnected, "A", "Z", 3);
        expect(result).toHaveLength(0);
        const frames = [...mod.run({ ...input, target: "Z" })];
        expect(frames.at(-1)?.meta["paths"]).toBe(0);
    });

    it("handles source equal to target", () => {
        const result = eppsteinKShortest(input.graph, "A", "A", 3);
        expect(result).toHaveLength(1);
        expect(result[0]?.cost).toBe(0);
        expect(result[0]?.vertices).toEqual(["A"]);
    });
});
