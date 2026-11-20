/** replace-by.test.ts - Max-flow correctness, frames, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./replace-by";
import type { VisualFrame } from "@/types";

type Graph = Record<string, Array<[string, number]>>;

function checkFrames(frames: VisualFrame[], nodes: number, arcs: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodes);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.length).toBe(arcs);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        frame.edges.forEach((e) => {
            expect(ids.has(e.sourceId)).toBe(true);
            expect(ids.has(e.targetId)).toBe(true);
        });
    });
}

/** Independent Edmonds-Karp max-flow oracle with explicit reverse residual arcs. */
function edmondsKarp(graph: Graph, source: string, sink: string): number {
    const residual = new Map<string, number>();
    const nodes = new Set(Object.keys(graph));
    for (const [u, edges] of Object.entries(graph)) {
        for (const [v, cap] of edges) {
            nodes.add(u);
            nodes.add(v);
            const key = `${u}>${v}`;
            const rev = `${v}>${u}`;
            residual.set(key, (residual.get(key) ?? 0) + cap);
            residual.set(rev, residual.get(rev) ?? 0);
        }
    }
    let flow = 0;
    for (;;) {
        const parent = new Map<string, string>();
        const queue = [source];
        const seen = new Set<string>([source]);
        while (queue.length > 0 && !seen.has(sink)) {
            const u = queue.shift()!;
            for (const v of nodes) {
                if (!seen.has(v) && (residual.get(`${u}>${v}`) ?? 0) > 0) {
                    seen.add(v);
                    parent.set(v, u);
                    queue.push(v);
                    if (v === sink) break;
                }
            }
        }
        if (!seen.has(sink)) break;
        let bottleneck = Infinity;
        let v = sink;
        while (v !== source) {
            const u = parent.get(v)!;
            bottleneck = Math.min(bottleneck, residual.get(`${u}>${v}`) ?? 0);
            v = u;
        }
        v = sink;
        while (v !== source) {
            const u = parent.get(v)!;
            residual.set(`${u}>${v}`, (residual.get(`${u}>${v}`) ?? 0) - bottleneck);
            residual.set(`${v}>${u}`, (residual.get(`${v}>${u}`) ?? 0) + bottleneck);
            v = u;
        }
        flow += bottleneck;
    }
    return flow;
}

describe("Replace-By Ford-Fulkerson", () => {
    it("matches an independent Edmonds-Karp oracle on several networks", () => {
        const graphs: Array<{ graph: Graph; source: string; sink: string }> = [
            {
                graph: {
                    S: [["A", 3], ["B", 2]],
                    A: [["T", 2], ["B", 1]],
                    B: [["T", 3]],
                    T: [],
                },
                source: "S",
                sink: "T",
            },
            {
                graph: {
                    S: [["A", 1], ["B", 1]],
                    A: [["B", 1], ["T", 1]],
                    B: [["A", 1], ["T", 1]],
                    T: [],
                },
                source: "S",
                sink: "T",
            },
            {
                graph: {
                    S: [["A", 4], ["B", 3], ["C", 2]],
                    A: [["D", 3]],
                    B: [["D", 2], ["E", 2]],
                    C: [["E", 2]],
                    D: [["T", 4]],
                    E: [["T", 3]],
                    T: [],
                },
                source: "S",
                sink: "T",
            },
        ];
        for (const { graph, source, sink } of graphs) {
            const frames = [...mod.run({ graph, source, sink })];
            const nodes = new Set([...Object.keys(graph), ...Object.values(graph).flat().map(([v]) => v)]);
            const arcs = Object.values(graph).reduce((n, e) => n + e.length, 0);
            checkFrames(frames, nodes.size, arcs);
            const final = frames[frames.length - 1]!.meta;
            expect(Number(final["flow"])).toBe(edmondsKarp(graph, source, sink));
            expect(Number(final["cutCapacity"])).toBe(Number(final["flow"]));
            frames.slice(1, -1).forEach((frame, i) => {
                expect(Number(frame.meta["flow"])).toBeGreaterThan(i === 0 ? 0 : Number(frames[i]!.meta["flow"]));
            });
        }
    });

    it("handles a network with no path", () => {
        const graph: Graph = { S: [["A", 2]], A: [], T: [] };
        const frames = [...mod.run({ graph, source: "S", sink: "T" })];
        checkFrames(frames, 3, 1);
        expect(frames[frames.length - 1]!.meta["flow"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
