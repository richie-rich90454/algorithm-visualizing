/**
 * k-shortest-edge-disjoint.test.ts - Brute-force minimum-cost comparison,
 * route validity and disjointness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./k-shortest-edge-disjoint";
import type { VisualFrame } from "@/types";

type Weighted = Record<string, Array<[string, number]>>;
interface Route {
    path: string[];
    cost: number;
    edges: Set<string>;
}

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

function allSimplePaths(graph: Weighted, source: string, target: string): Route[] {
    const results: Route[] = [];
    const walk = (at: string, seen: Set<string>, path: string[], cost: number, edges: Set<string>): void => {
        if (at === target) {
            results.push({ path: [...path], cost, edges: new Set(edges) });
            return;
        }
        for (const [next, weight] of graph[at] ?? []) {
            if (seen.has(String(next))) continue;
            const edgeKey = [at, String(next)].sort().join("|");
            if (edges.has(edgeKey)) continue;
            seen.add(String(next));
            path.push(String(next));
            edges.add(edgeKey);
            walk(String(next), seen, path, cost + weight, edges);
            edges.delete(edgeKey);
            path.pop();
            seen.delete(String(next));
        }
    };
    walk(source, new Set([source]), [source], 0, new Set());
    return results;
}

function bruteMinDisjoint(graph: Weighted, source: string, target: string, k: number): { count: number; cost: number } {
    const paths = allSimplePaths(graph, source, target);
    let bestCount = 0;
    let bestCost = 0;
    const dfs = (start: number, used: Set<string>, count: number, cost: number): void => {
        if (count > bestCount || (count === bestCount && cost < bestCost)) {
            bestCount = count;
            bestCost = cost;
        }
        if (count === k) return;
        for (let i = start; i < paths.length; i += 1) {
            const route = paths[i]!;
            let disjoint = true;
            for (const edge of route.edges) {
                if (used.has(edge)) {
                    disjoint = false;
                    break;
                }
            }
            if (!disjoint) continue;
            for (const edge of route.edges) used.add(edge);
            dfs(i + 1, used, count + 1, cost + route.cost);
            for (const edge of route.edges) used.delete(edge);
        }
    };
    dfs(0, new Set(), 0, 0);
    return { count: bestCount, cost: bestCost };
}

function parseRoutes(values: string[]): Array<{ path: string[]; cost: number }> {
    return values.map((value) => {
        const [pathPart, costPart] = value.split("=");
        return { path: pathPart!.split(">"), cost: Number(costPart) };
    });
}

describe("K Shortest Edge-Disjoint Paths", () => {
    const cases: Array<{ graph: Weighted; source: string; target: string; k: number }> = [
        {
            graph: (mod.defaultInput as { graph: Weighted }).graph,
            source: "A",
            target: "G",
            k: 3,
        },
        {
            graph: {
                A: [["B", 1], ["C", 1]],
                B: [["A", 1], ["D", 1]],
                C: [["A", 1], ["D", 1]],
                D: [["B", 1], ["C", 1]],
            },
            source: "A",
            target: "D",
            k: 2,
        },
        {
            graph: {
                A: [["B", 1], ["C", 2]],
                B: [["A", 1], ["C", 1], ["D", 3]],
                C: [["A", 2], ["B", 1], ["D", 1]],
                D: [["B", 3], ["C", 1]],
            },
            source: "A",
            target: "D",
            k: 2,
        },
        {
            graph: { A: [["B", 1]], B: [["A", 1], ["C", 1]], C: [["B", 1]] },
            source: "A",
            target: "C",
            k: 5,
        },
    ];

    it("matches brute-force minimum total cost", () => {
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const final = frames[frames.length - 1]!;
            const expected = bruteMinDisjoint(testCase.graph, testCase.source, testCase.target, testCase.k);
            expect(final.meta["count"]).toBe(expected.count);
            expect(final.meta["totalCost"]).toBe(expected.cost);
        }
    });

    it("returns valid, simple, pairwise edge-disjoint routes", () => {
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            const routes = parseRoutes(frames[frames.length - 1]!.meta["routes"] as string[]);
            const used = new Set<string>();
            for (const route of routes) {
                expect(route.path[0]).toBe(testCase.source);
                expect(route.path[route.path.length - 1]).toBe(testCase.target);
                expect(new Set(route.path).size).toBe(route.path.length);
                let computed = 0;
                for (let i = 0; i + 1 < route.path.length; i += 1) {
                    const from = route.path[i]!;
                    const to = route.path[i + 1]!;
                    const edge = (testCase.graph[from] ?? []).find(([neighbor]) => String(neighbor) === to);
                    expect(edge).toBeDefined();
                    computed += edge![1];
                    const key = [from, to].sort().join("|");
                    expect(used.has(key)).toBe(false);
                    used.add(key);
                }
                expect(route.cost).toBe(computed);
            }
        }
    });

    it("handles an empty graph and terminates", () => {
        const empty = [...mod.run({ graph: {} })];
        checkFrames(empty);
        expect(empty[empty.length - 1]!.meta["count"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
