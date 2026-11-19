/**
 * bidirectional-a-star.test.ts - optimality vs Dijkstra, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./bidirectional-a-star";
import type { VisualFrame } from "@/types";

type Graph = Record<string, Array<[string, number]>>;
type Coords = Record<string, [number, number]>;

function dijkstra(graph: Graph, start: string, goal: string): number {
    const dist = new Map<string, number>();
    for (const v of Object.keys(graph)) dist.set(v, Infinity);
    dist.set(start, 0);
    const done = new Set<string>();
    for (;;) {
        let u: string | undefined;
        let best = Infinity;
        for (const [v, d] of dist) if (!done.has(v) && d < best) [u, best] = [v, d];
        if (u === undefined) break;
        done.add(u);
        for (const [next, w] of graph[u] ?? []) {
            dist.set(next, Math.min(dist.get(next) ?? Infinity, best + w));
        }
    }
    return dist.get(goal) ?? Infinity;
}

function costOfPath(graph: Graph, path: string[]): number {
    let total = 0;
    for (let i = 0; i + 1 < path.length; i += 1) {
        const edge = (graph[path[i] ?? ""] ?? []).find(([to]) => to === path[i + 1]);
        const reverse = (graph[path[i + 1] ?? ""] ?? []).find(([to]) => to === path[i]);
        if (edge) total += edge[1];
        else if (reverse) total += reverse[1];
        else return Infinity;
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
    frames.forEach((frame, i) => expect(frame.stepNumber).toBe(i));
}

function evaluate(graph: Graph, coords: Coords, start: string, goal: string) {
    const frames = [...mod.run({ graph, coords, start, goal })];
    checkFrames(frames);
    const final = frames[frames.length - 1]?.meta as Record<string, unknown>;
    return { frames, cost: Number(final["cost"]), path: final["path"] as string[] };
}

describe("Bidirectional A*", () => {
    it("matches Dijkstra on the default input", () => {
        const input = mod.defaultInput as { graph: Graph; coords: Coords; start: string; goal: string };
        const result = evaluate(input.graph, input.coords, input.start, input.goal);
        const optimum = dijkstra(input.graph, input.start, input.goal);
        expect(result.cost).toBeCloseTo(optimum, 10);
        expect(result.path[0]).toBe(input.start);
        expect(result.path[result.path.length - 1]).toBe(input.goal);
        expect(costOfPath(input.graph, result.path)).toBeCloseTo(result.cost, 10);
    });

    it("matches Dijkstra on random graphs with consistent euclidean heuristics", () => {
        let seed = 7;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        const labels = ["A", "B", "C", "D", "E", "F"];
        const coords: Coords = {
            A: [0, 0], B: [1, 0], C: [2, 0], D: [0, 1], E: [1, 1], F: [2, 1],
        };
        for (let trial = 0; trial < 12; trial += 1) {
            const graph: Graph = Object.fromEntries(labels.map((l) => [l, []]));
            for (let i = 0; i < labels.length; i += 1) {
                for (let j = i + 1; j < labels.length; j += 1) {
                    if (rand() < 0.55) {
                        const [ax, ay] = coords[labels[i]] ?? [0, 0];
                        const [bx, by] = coords[labels[j]] ?? [0, 0];
                        const euclid = Math.hypot(ax - bx, ay - by);
                        const w = Math.max(1, Math.ceil(euclid + rand() * 3));
                        graph[labels[i]]?.push([labels[j], w]);
                        graph[labels[j]]?.push([labels[i], w]);
                    }
                }
            }
            graph["A"]?.push(["F", 20]);
            graph["F"]?.push(["A", 20]);
            const result = evaluate(graph, coords, "A", "F");
            expect(result.cost).toBeCloseTo(dijkstra(graph, "A", "F"), 10);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
