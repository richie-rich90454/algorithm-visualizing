/**
 * desopo-pape-algorithm.test.ts - label correctness vs Bellman-Ford, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./desopo-pape-algorithm";
import type { VisualFrame } from "@/types";

type Graph = Record<string, Array<[string, number]>>;

function bellmanFord(graph: Graph, start: string, goal: string): number {
    const dist = new Map<string, number>();
    for (const v of Object.keys(graph)) dist.set(v, Infinity);
    dist.set(start, 0);
    for (let i = 0; i < Object.keys(graph).length - 1; i += 1) {
        for (const [u, adj] of Object.entries(graph)) {
            for (const [v, w] of adj) {
                dist.set(v, Math.min(dist.get(v) ?? Infinity, (dist.get(u) ?? Infinity) + w));
            }
        }
    }
    return dist.get(goal) ?? Infinity;
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

function run(graph: Graph, start: string, target: string) {
    const frames = [...mod.run({ graph, start, target })];
    checkFrames(frames);
    const final = frames[frames.length - 1]?.meta as Record<string, unknown>;
    return { frames, cost: Number(final["cost"]) };
}

describe("Dees-Pape Shortest Paths", () => {
    it("matches Bellman-Ford on the default input", () => {
        const input = mod.defaultInput as { graph: Graph; start: string; target: string };
        const result = run(input.graph, input.start, input.target);
        expect(result.cost).toBeCloseTo(bellmanFord(input.graph, input.start, input.target), 10);
    });

    it("matches Bellman-Ford on random directed graphs", () => {
        let seed = 19;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        const labels = ["A", "B", "C", "D", "E"];
        for (let trial = 0; trial < 20; trial += 1) {
            const graph: Graph = Object.fromEntries(labels.map((l) => [l, []]));
            for (let i = 0; i < labels.length; i += 1) {
                for (let j = 0; j < labels.length; j += 1) {
                    if (i !== j && rand() < 0.4) {
                        graph[labels[i]]?.push([labels[j], 1 + Math.floor(rand() * 12)]);
                    }
                }
            }
            graph["A"]?.push(["E", 30]);
            const result = run(graph, "A", "E");
            expect(result.cost).toBeCloseTo(bellmanFord(graph, "A", "E"), 10);
        }
    });

    it("reports unreachable targets with cost -1", () => {
        const graph: Graph = { A: [["B", 1]], B: [], C: [] };
        const result = run(graph, "A", "C");
        expect(result.cost).toBe(-1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
