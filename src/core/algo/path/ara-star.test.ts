/** ara-star.test.ts - Dijkstra brute-force cross-check, path validity, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./ara-star";
import type { VisualFrame } from "@/types";

type Adjacency = Record<string, Array<[string, number]>>;
const input = mod.defaultInput as { graph: Adjacency; start: string; goal: string; epsilons: number[] };

/** Dijkstra with a scanning priority queue: brute-force optimal cost. */
function optimalCost(graph: Adjacency, start: string, goal: string): number {
    const dist = new Map<string, number>([[start, 0]]);
    const done = new Set<string>();
    for (;;) {
        let current = "";
        let best = Number.POSITIVE_INFINITY;
        for (const [node, d] of dist) {
            if (!done.has(node) && d < best) {
                best = d;
                current = node;
            }
        }
        if (current === "") break;
        if (current === goal) return best;
        done.add(current);
        for (const [next, w] of graph[current] ?? []) {
            const candidate = best + w;
            if (candidate < (dist.get(next) ?? Number.POSITIVE_INFINITY)) dist.set(next, candidate);
        }
    }
    return Number.POSITIVE_INFINITY;
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

describe("ARA*", () => {
    const edgeCount = Object.values(input.graph).reduce((s, list) => s + list.length, 0);
    const vertexCount = new Set([...Object.keys(input.graph), ...Object.values(input.graph).flat().map((e) => e[0])]).size;

    it("converges to the Dijkstra optimum with nonincreasing anytime costs", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, vertexCount, edgeCount);
        const costs = (frames.at(-1)?.meta["costs"] as number[]) ?? [];
        const optimum = optimalCost(input.graph, input.start, input.goal);
        expect(costs.length).toBe(input.epsilons.length);
        expect(optimum).toBe(4);
        expect(costs[costs.length - 1]).toBe(optimum);
        for (let i = 0; i < costs.length; i += 1) {
            expect(costs[i] as number).toBeGreaterThanOrEqual(optimum);
            if (i > 0) expect(costs[i] as number).toBeLessThanOrEqual(costs[i - 1] as number);
        }
    });

    it("reports valid paths whose edge weights sum to the reported cost", () => {
        const frames = [...mod.run(input)];
        let pathsChecked = 0;
        for (const frame of frames) {
            const raw = frame.meta["path"];
            if (!Array.isArray(raw) || raw.length === 0 || raw[0] === "none") continue;
            const path = raw.map(String);
            expect(path[0]).toBe(input.start);
            expect(path[path.length - 1]).toBe(input.goal);
            let sum = 0;
            for (let i = 0; i + 1 < path.length; i += 1) {
                const w = edgeWeight(input.graph, path[i] as string, path[i + 1] as string);
                expect(w).toBeDefined();
                sum += w as number;
            }
            expect(sum).toBeCloseTo(Number(frame.meta["cost"]), 9);
            pathsChecked += 1;
        }
        expect(pathsChecked).toBe(input.epsilons.length);
    });

    it("matches optimal cost when epsilon is already one", () => {
        const single = { ...input, epsilons: [1] };
        const costs = [...mod.run(single)].at(-1)?.meta["costs"] as number[];
        expect(costs[0]).toBe(optimalCost(input.graph, input.start, input.goal));
    });

    it("terminates cleanly on an unreachable goal", () => {
        const disconnected: Adjacency = { ...input.graph, I: [] };
        delete disconnected["F"];
        delete disconnected["H"];
        const frames = [...mod.run({ ...input, graph: disconnected, start: "A", goal: "Z" })];
        expect(frames.length).toBeGreaterThan(0);
        expect(frames.at(-1)?.meta["bestCost"]).toBe(-1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
