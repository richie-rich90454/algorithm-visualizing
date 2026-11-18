/**
 * weighted-a-star.test.ts - Optimality-bound check, path validity, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./weighted-a-star";
import type { VisualFrame } from "@/types";

type Graph = Record<string, Array<[string, number]>>;

/** Independent Dijkstra computing the true shortest path cost. */
function dijkstra(graph: Graph, start: string, target: string): number {
    const dist = new Map<string, number>();
    for (const vertex of Object.keys(graph)) {
        dist.set(vertex, Number.POSITIVE_INFINITY);
    }
    dist.set(start, 0);
    const visited = new Set<string>();
    while (true) {
        let current: string | undefined;
        let best = Number.POSITIVE_INFINITY;
        for (const [vertex, value] of dist) {
            if (!visited.has(vertex) && value < best) {
                best = value;
                current = vertex;
            }
        }
        if (current === undefined) {
            break;
        }
        visited.add(current);
        for (const [neighbor, cost] of graph[current] ?? []) {
            const candidate = best + cost;
            if (candidate < (dist.get(neighbor) ?? Number.POSITIVE_INFINITY)) {
                dist.set(neighbor, candidate);
            }
        }
    }
    return dist.get(target) ?? Number.POSITIVE_INFINITY;
}

function costOfPath(graph: Graph, path: string[]): number {
    let total = 0;
    for (let i = 0; i < path.length - 1; i += 1) {
        const edge = (graph[path[i] ?? ""] ?? []).find(([to]) => to === path[i + 1]);
        if (!edge) {
            return Number.POSITIVE_INFINITY;
        }
        total += edge[1];
    }
    return total;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    const seen = new Set<number>();
    frames.forEach((frame) => {
        expect(frame.layout).toBe("graph");
        expect(seen.has(frame.stepNumber)).toBe(false);
        seen.add(frame.stepNumber);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    for (let i = 0; i < frames.length; i += 1) {
        expect(frames[i]?.stepNumber).toBe(i);
    }
}

function evaluate(graph: Graph, start: string, target: string, weight: number) {
    const frames = [...mod.run({ graph, start, target, weight })];
    checkFrames(frames);
    const final = frames[frames.length - 1]?.meta;
    return {
        cost: Number(final?.["cost"]),
        optimal: Number(final?.["optimal"]),
        path: final?.["path"] as string[],
        frames,
    };
}

describe("WeightedAStar", () => {
    it("matches Dijkstra exactly when the weight is one", () => {
        const { graph, start, target } = mod.defaultInput as { graph: Graph; start: string; target: string };
        const result = evaluate(graph, start, target, 1);
        const optimum = dijkstra(graph, start, target);
        expect(result.optimal).toBeCloseTo(optimum, 10);
        expect(result.cost).toBeCloseTo(optimum, 10);
        expect(result.path[0]).toBe(start);
        expect(result.path[result.path.length - 1]).toBe(target);
        expect(costOfPath(graph, result.path)).toBeCloseTo(result.cost, 10);
    });

    it("stays within w times the optimum on random graphs", () => {
        let seed = 41;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        const labels = ["A", "B", "C", "D", "E", "F"];
        for (let trial = 0; trial < 15; trial += 1) {
            const graph: Graph = {};
            for (const label of labels) {
                graph[label] = [];
            }
            for (let i = 0; i < labels.length; i += 1) {
                for (let j = i + 1; j < labels.length; j += 1) {
                    if (rand() < 0.5) {
                        const cost = 1 + Math.floor(rand() * 9);
                        graph[labels[i] ?? "A"]?.push([labels[j] ?? "B", cost]);
                        graph[labels[j] ?? "B"]?.push([labels[i] ?? "A", cost]);
                    }
                }
            }
            graph["A"]?.push(["F", 25]);
            const weight = 1 + Math.floor(rand() * 3);
            const result = evaluate(graph, "A", "F", weight);
            const optimum = dijkstra(graph, "A", "F");
            expect(result.optimal).toBeCloseTo(optimum, 10);
            expect(result.cost).toBeGreaterThanOrEqual(optimum - 1e-9);
            expect(result.cost).toBeLessThanOrEqual(weight * optimum + 1e-9);
            expect(result.path[0]).toBe("A");
            expect(result.path[result.path.length - 1]).toBe("F");
            expect(costOfPath(graph, result.path)).toBeCloseTo(result.cost, 10);
        }
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
