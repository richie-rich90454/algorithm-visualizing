/**
 * minimum-degree-ordering.test.ts - Independent minimum-degree simulation,
 * fill-edge property check, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./minimum-degree-ordering";
import type { VisualFrame } from "@/types";

type Adj = Record<string, string[]>;

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

/** Reference simulation that rebuilds degrees from scratch on every step. */
function reference(adjacency: Adj): { order: string[]; fill: string[] } {
    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])].sort();
    const edges = new Set<string>();
    const key = (a: string, b: string): string => [a, b].sort().join("|");
    for (const a of labels) {
        for (const b of adjacency[a] ?? []) {
            if (a !== b && labels.includes(String(b))) {
                edges.add(key(a, String(b)));
            }
        }
    }
    const remaining = new Set(labels);
    const order: string[] = [];
    const fill: string[] = [];
    while (remaining.size > 0) {
        const degree = (v: string): number =>
            [...remaining].filter((u) => u !== v && edges.has(key(v, u))).length;
        let chosen = "";
        let best = Infinity;
        for (const v of labels) {
            if (!remaining.has(v)) {
                continue;
            }
            const d = degree(v);
            if (d < best) {
                best = d;
                chosen = v;
            }
        }
        const neighbors = [...remaining].filter((u) => u !== chosen && edges.has(key(chosen, u)));
        for (let i = 0; i < neighbors.length; i += 1) {
            for (let j = i + 1; j < neighbors.length; j += 1) {
                const k = key(neighbors[i] as string, neighbors[j] as string);
                if (!edges.has(k)) {
                    edges.add(k);
                    fill.push(k);
                }
            }
        }
        order.push(chosen);
        remaining.delete(chosen);
    }
    return { order, fill };
}

describe("Minimum Degree Ordering", () => {
    it("matches an independent simulation on several graphs", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { graph: Adj }).graph,
            { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
            { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["A", "B", "C"] },
            { A: ["B", "C"], B: ["A"], C: ["A"], D: [] },
        ];
        for (const graph of graphs) {
            const frames = [...mod.run({ graph })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const expected = reference(graph);
            expect(meta?.["order"]).toEqual(expected.order);
            expect(meta?.["fillCount"]).toBe(expected.fill.length);
        }
    });

    it("honors the least-degree rule at every step", () => {
        const graph = (mod.defaultInput as { graph: Adj }).graph;
        const frames = [...mod.run({ graph })];
        for (const frame of frames) {
            const meta = frame.meta;
            const pivot = String(meta["pivot"]);
            if (pivot === "") {
                continue;
            }
            const order = meta["order"] as string[];
            const done = new Set(order.slice(0, -1));
            const edges = new Set<string>();
            const key = (a: string, b: string): string => [a, b].sort().join("|");
            const labels = Object.keys(graph);
            for (const a of labels) {
                for (const b of graph[a] ?? []) {
                    edges.add(key(a, String(b)));
                }
            }
            for (const e of frame.edges) {
                if (e.state === "swapped") {
                    edges.add(key(e.sourceId.replace("node-", ""), e.targetId.replace("node-", "")));
                }
            }
            const remaining = labels.filter((v) => !done.has(v));
            const degree = (v: string): number => remaining.filter((u) => u !== v && edges.has(key(v, u))).length;
            const min = Math.min(...remaining.map(degree));
            expect(degree(pivot)).toBe(min);
            expect(Number(meta["degree"])).toBe(min);
        }
    });

    it("handles an empty graph and terminates", () => {
        const empty = [...mod.run({ graph: {} })];
        checkFrames(empty);
        expect(empty[empty.length - 1]?.meta["fillCount"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
