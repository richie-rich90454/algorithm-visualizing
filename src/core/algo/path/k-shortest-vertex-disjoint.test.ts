/**
 * k-shortest-vertex-disjoint.test.ts - Route validity, pairwise vertex
 * disjointness, greedy costs against brute-force path enumeration, frame
 * shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./k-shortest-vertex-disjoint";
import type { VisualFrame } from "@/types";

type Weighted = Record<string, Array<[string, number]>>;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function pathCost(graph: Weighted, path: string[]): number {
    let total = 0;
    for (let i = 0; i + 1 < path.length; i += 1) {
        const arc = (graph[path[i] as string] ?? []).find(([to]) => to === path[i + 1]);
        if (!arc) return Infinity;
        total += arc[1];
    }
    return total;
}

/** Exhaustive cheapest simple path that avoids the given internal vertices. */
function bruteCheapest(graph: Weighted, source: string, target: string, banned: Set<string>): number {
    let best = Infinity;
    const search = (v: string, path: string[], cost: number): void => {
        if (v === target) {
            best = Math.min(best, cost);
            return;
        }
        for (const [to, w] of graph[v] ?? []) {
            if (path.includes(to)) continue;
            if (to !== target && banned.has(to)) continue;
            search(to, [...path, to], cost + w);
        }
    };
    search(source, [source], 0);
    return best;
}

describe("K Shortest Vertex-Disjoint Paths", () => {
    it("produces valid, pairwise disjoint routes with brute-force greedy costs", () => {
        const input = mod.defaultInput as { graph: Weighted; source: string; target: string; k: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const entries = (meta?.["paths"] as string[]) ?? [];
        expect(entries.length).toBe(Number(meta?.["count"]));
        expect(entries.length).toBeLessThanOrEqual(input.k);
        const used = new Set<string>();
        let running = 0;
        for (const entry of entries) {
            const [route, costText] = entry.split("=");
            const path = (route ?? "").split(">");
            expect(path[0]).toBe(input.source);
            expect(path[path.length - 1]).toBe(input.target);
            const realCost = pathCost(input.graph, path);
            expect(Number.isFinite(realCost)).toBe(true);
            expect(realCost).toBe(Number(costText));
            for (const v of path.slice(1, -1)) {
                expect(used.has(v as string)).toBe(false);
                used.add(v as string);
            }
            running += realCost;
        }
        expect(Number(meta?.["totalCost"])).toBe(running);
        const banned = new Set((meta?.["banned"] as string[]) ?? []);
        expect([...banned].sort()).toEqual([...used].sort());

        const expected: number[] = [];
        const cumulative = new Set<string>();
        for (let round = 0; round < input.k; round += 1) {
            const cost = bruteCheapest(input.graph, input.source, input.target, cumulative);
            if (!Number.isFinite(cost)) break;
            expected.push(cost);
            // Recover the corresponding route's internal vertices from the reported paths.
            const entry = entries[round];
            if (!entry) break;
            const route = (entry.split("=")[0] ?? "").split(">");
            for (const v of route.slice(1, -1)) cumulative.add(v as string);
        }
        expect(entries.map((e) => Number(e.split("=")[1]))).toEqual(expected);
    });

    it("handles a graph with no route and terminates", () => {
        const frames = [...mod.run({ graph: { A: [["B", 1]], B: [], C: [] }, source: "A", target: "C", k: 2 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["count"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
