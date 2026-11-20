/** real-time-a-star.test.ts - Independent Dijkstra cross-check, path validity, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./real-time-a-star";
import type { VisualFrame } from "@/types";

type WGraph = Record<string, Array<[string, number]>>;

function dijkstra(graph: WGraph, source: string): Map<string, number> {
    const dist = new Map<string, number>([[source, 0]]);
    const visited = new Set<string>();
    while (true) {
        let best: string | null = null;
        let bestD = Infinity;
        for (const [v, d] of dist) {
            if (!visited.has(v) && d < bestD) {
                best = v;
                bestD = d;
            }
        }
        if (best === null) break;
        visited.add(best);
        for (const [nb, w] of graph[best] ?? []) {
            const nd = bestD + w;
            if (nd < (dist.get(nb) ?? Infinity)) dist.set(nb, nd);
        }
    }
    return dist;
}

function edgeCost(graph: WGraph, a: string, b: string): number {
    for (const [nb, w] of graph[a] ?? []) if (nb === b) return w;
    return Infinity;
}

function finalMeta(input: unknown): Record<string, unknown> {
    const frames = [...mod.run(input)];
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        for (const e of frame.edges) {
            expect(frame.entities.some((n) => n.id === e.sourceId)).toBe(true);
            expect(frame.entities.some((n) => n.id === e.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Real-Time A*", () => {
    it("finds optimal paths for varied start and goal pairs", () => {
        const graph = (mod.defaultInput as { graph: WGraph }).graph;
        const pairs: Array<[string, string]> = [
            ["A", "F"],
            ["C", "F"],
            ["F", "A"],
            ["B", "E"],
        ];
        for (const [start, goal] of pairs) {
            const trueDist = dijkstra(graph, goal);
            const heuristic: Record<string, number> = {};
            for (const [v, d] of trueDist) heuristic[v] = d;
            const meta = finalMeta({ graph, start, goal, heuristic });
            expect(meta["reached"]).toBe(true);
            const expected = dijkstra(graph, start).get(goal) as number;
            expect(meta["cost"]).toBe(expected);
            const path = String(meta["path"] ?? "").split("->");
            expect(path[0]).toBe(start);
            expect(path[path.length - 1]).toBe(goal);
            let total = 0;
            for (let i = 1; i < path.length; i += 1) {
                const w = edgeCost(graph, path[i - 1] as string, path[i] as string);
                expect(Number.isFinite(w)).toBe(true);
                total += w;
            }
            expect(total).toBe(meta["cost"]);
        }
    });

    it("has well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
