/**
 * lpa-star.test.ts - Independent Dijkstra cross-check, path validity, upper-bound
 * property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./lpa-star";
import type { VisualFrame } from "@/types";

type Graph = Record<string, Array<[string, number]>>;

function vertices(graph: Graph, ...extra: string[]): string[] {
    return [
        ...new Set([
            ...Object.keys(graph),
            ...Object.values(graph).flatMap((list) => list.map(([to]) => to)),
            ...extra,
        ]),
    ];
}

/** Independent Dijkstra with a linear minimum scan. */
function dijkstra(graph: Graph, start: string): Record<string, number> {
    const nodes = vertices(graph, start);
    const dist: Record<string, number> = {};
    for (const v of nodes) dist[v] = Infinity;
    dist[start] = 0;
    const visited = new Set<string>();
    for (;;) {
        let best: string | null = null;
        for (const v of nodes) {
            if (visited.has(v)) continue;
            if (best === null || (dist[v] ?? Infinity) < (dist[best] ?? Infinity)) best = v;
        }
        if (best === null || !Number.isFinite(dist[best] ?? Infinity)) break;
        visited.add(best);
        for (const [to, weight] of graph[best] ?? []) {
            const candidate = (dist[best] ?? Infinity) + weight;
            if (candidate < (dist[to] ?? Infinity)) dist[to] = candidate;
        }
    }
    return dist;
}

function costOfPath(graph: Graph, path: string[]): number {
    let total = 0;
    for (let i = 1; i < path.length; i += 1) {
        const from = path[i - 1] ?? "";
        const to = path[i] ?? "";
        const edge = (graph[from] ?? []).find(([v]) => v === to);
        if (!edge) return Infinity;
        total += edge[1];
    }
    return total;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.every((e) => frame.entities.some((n) => n.id === e.sourceId) && frame.entities.some((n) => n.id === e.targetId))).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(Array.isArray(frame.meta["gValues"])).toBe(true);
    });
}

function finalMeta(frames: VisualFrame[]): Record<string, unknown> {
    return frames[frames.length - 1]?.meta ?? {};
}

describe("Lifelong Planning A*", () => {
    it("matches Dijkstra before and after a cost change, with a valid path", () => {
        const input = mod.defaultInput as {
            graph: Graph;
            start: string;
            goal: string;
            changes: Array<[string, string, number]>;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);

        const before = dijkstra(input.graph, input.start);
        const firstPathFrame = frames.find((f) => f.meta["phase"] === "path");
        const firstCost = Number(firstPathFrame?.meta["cost"]);
        expect(firstCost).toBeCloseTo(before[input.goal] ?? Infinity, 9);
        expect(costOfPath(input.graph, firstPathFrame?.meta["path"] as string[])).toBeCloseTo(firstCost, 9);

        const changed: Graph = JSON.parse(JSON.stringify(input.graph));
        const [u, v, w] = input.changes[0] ?? [];
        if (u && v && w !== undefined) {
            const edge = (changed[u] ?? []).find(([to]) => to === v);
            if (edge) edge[1] = w;
            else (changed[u] ??= []).push([v, w]);
        }
        const after = dijkstra(changed, input.start);
        const final = finalMeta(frames);
        expect(Number(final["cost"])).toBeCloseTo(after[input.goal] ?? Infinity, 9);
        expect(costOfPath(changed, final["path"] as string[])).toBeCloseTo(Number(final["cost"]), 9);
    });

    it("handles decreases, multiple changes, and an unreachable goal", () => {
        const graph: Graph = {
            A: [
                ["B", 1],
                ["C", 7],
            ],
            B: [["D", 8]],
            C: [["D", 1]],
            D: [],
        };
        const frames = [...mod.run({ graph, start: "A", goal: "D", changes: [["B", "D", 2], ["C", "D", 9]] })];
        checkFrames(frames);
        const final = finalMeta(frames);
        const expected = dijkstra({ ...graph, B: [["D", 2]], C: [["D", 9]] }, "A");
        expect(Number(final["cost"])).toBe(expected["D"]);

        const unreachable = [...mod.run({
            graph: { A: [["B", 1]], B: [], C: [] },
            start: "A",
            goal: "C",
        })];
        checkFrames(unreachable);
        expect(finalMeta(unreachable)["cost"]).toBe("inf");
        expect(finalMeta(unreachable)["path"]).toEqual([]);
    });

    it("keeps g values at or above the true distances", () => {
        const input = mod.defaultInput as { graph: Graph; start: string; goal: string };
        const frames = [...mod.run(input)];
        const trueDist = dijkstra(input.graph, input.start);
        const nodes = vertices(input.graph);
        const final = finalMeta(frames);
        const gValues = final["gValues"] as Array<number | string>;
        gValues.forEach((value, i) => {
            const node = nodes[i];
            expect(typeof value === "string" ? Infinity : value).toBeGreaterThanOrEqual(trueDist[node ?? ""] ?? Infinity);
        });
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
    });
});
