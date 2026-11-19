/**
 * reach-routing.test.ts - Independent Dijkstra-based reach check, nonnegativity
 * property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./reach-routing";
import type { VisualFrame } from "@/types";

type WAdj = Record<string, Array<[string, number]>>;

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

/** All-pairs distances by running Dijkstra once per source. */
function dijkstraAllPairs(graph: WAdj): { labels: string[]; dist: number[][] } {
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flatMap((vs) => vs.map(([v]) => String(v)))])].sort();
    const idx = new Map(labels.map((v, i) => [v, i] as const));
    const INF = Number.POSITIVE_INFINITY;
    return {
        labels,
        dist: labels.map((source) => {
            const d = Array<number>(labels.length).fill(INF);
            const src = idx.get(source) as number;
            d[src] = 0;
            const done = new Set<number>();
            for (let iter = 0; iter < labels.length; iter += 1) {
                let u = -1;
                let best = INF;
                for (let i = 0; i < labels.length; i += 1) {
                    if (!done.has(i) && (d[i] as number) < best) {
                        best = d[i] as number;
                        u = i;
                    }
                }
                if (u === -1 || best === INF) {
                    break;
                }
                done.add(u);
                const label = labels[u] as string;
                for (const [vRaw, w] of graph[label] ?? []) {
                    const v = idx.get(String(vRaw));
                    if (v !== undefined && best + w < (d[v] as number)) {
                        d[v] = best + w;
                    }
                }
            }
            return d;
        }),
    };
}

function reachByDijkstra(graph: WAdj): number[] {
    const { labels, dist } = dijkstraAllPairs(graph);
    return labels.map((_v, v) => {
        let best = 0;
        for (let s = 0; s < labels.length; s += 1) {
            if (s === v) {
                continue;
            }
            for (let t = 0; t < labels.length; t += 1) {
                if (t === v || t === s) {
                    continue;
                }
                const viaSource = dist[s]?.[v] as number;
                const viaTarget = dist[v]?.[t] as number;
                const direct = dist[s]?.[t] as number;
                if (![viaSource, viaTarget, direct].every(Number.isFinite)) {
                    continue;
                }
                best = Math.max(best, viaSource + viaTarget - direct);
            }
        }
        return best;
    });
}

describe("REACH Routing Preprocessing", () => {
    it("matches reach values computed with Dijkstra distances", () => {
        const graphs: WAdj[] = [
            (mod.defaultInput as { graph: WAdj }).graph,
            {
                A: [
                    ["B", 2],
                    ["C", 9],
                ],
                B: [["D", 1]],
                C: [["D", 1]],
                D: [["E", 3]],
                E: [],
            },
            {
                A: [["B", 1]],
                B: [["C", 1]],
                C: [["D", 1]],
                D: [],
            },
        ];
        for (const graph of graphs) {
            const frames = [...mod.run({ graph })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["reach"]).toEqual(reachByDijkstra(graph));
        }
    });

    it("keeps reach nonnegative and zero without both an in- and out-edge", () => {
        const graph = (mod.defaultInput as { graph: WAdj }).graph;
        const frames = [...mod.run({ graph })];
        const reach = frames[frames.length - 1]?.meta["reach"] as number[];
        expect(reach.every((r) => r >= 0)).toBe(true);
        const labels = Object.keys(graph).sort();
        expect(reach[labels.indexOf("A")]).toBe(0);
        expect(reach[labels.indexOf("D")]).toBe(0);
    });

    it("handles an empty graph and terminates", () => {
        const empty = [...mod.run({ graph: {} })];
        checkFrames(empty);
        expect(empty[empty.length - 1]?.meta["reach"]).toEqual([]);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
