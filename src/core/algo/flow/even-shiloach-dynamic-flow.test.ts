/** even-shiloach-dynamic-flow.test.ts - Brute-force cross-check, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./even-shiloach-dynamic-flow";
import type { VisualFrame } from "@/types";

type E3 = [number, number, number];

/** Independent Edmonds-Karp reference over final capacities. */
function referenceMaxFlow(n: number, edges: E3[], s: number, t: number): number {
    if (s === t) return 0;
    const cap: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (const [u, v, w] of edges) {
        if (u !== v && u >= 0 && u < n && v >= 0 && v < n) {
            cap[u]![v] = (cap[u]![v] as number) + Math.max(0, w);
        }
    }
    let flow = 0;
    for (;;) {
        const parent = new Array<number>(n).fill(-1);
        parent[s] = -2;
        const queue = [s];
        while (queue.length > 0) {
            const u = queue.shift() as number;
            if (u === t) break;
            for (let v = 0; v < n; v += 1) {
                if (parent[v] === -1 && (cap[u]![v] as number) > 0) {
                    parent[v] = u;
                    queue.push(v);
                }
            }
        }
        if (parent[t] === -1) break;
        let bottleneck = Infinity;
        let cur = t;
        while (cur !== s) {
            const p = parent[cur] as number;
            bottleneck = Math.min(bottleneck, cap[p]![cur] as number);
            cur = p;
        }
        cur = t;
        while (cur !== s) {
            const p = parent[cur] as number;
            cap[p]![cur] = (cap[p]![cur] as number) - bottleneck;
            cap[cur]![p] = (cap[cur]![p] as number) + bottleneck;
            cur = p;
        }
        flow += bottleneck;
    }
    return flow;
}

function checkFrames(frames: VisualFrame[], vertexCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    const ids = new Set<string>();
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities).toHaveLength(vertexCount);
        ids.clear();
        for (const entity of frame.entities) {
            ids.add(entity.id);
            expect(entity.type).toBe("node");
        }
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("EvenShiloachDynamicFlow", () => {
    it("matches a brute-force max-flow reference after capacity insertions", () => {
        let seed = 98765;
        const rand = (limit: number): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed % limit;
        };
        for (let trial = 0; trial < 200; trial += 1) {
            const n = 2 + rand(5);
            const edges: E3[] = [];
            const count = 1 + rand(10);
            for (let i = 0; i < count; i += 1) {
                const u = rand(n);
                const v = rand(n);
                if (u !== v) edges.push([u, v, rand(10)]);
            }
            const insertions: E3[] = [];
            const insertCount = 1 + rand(4);
            for (let i = 0; i < insertCount; i += 1) {
                const u = rand(n);
                const v = rand(n);
                if (u !== v) insertions.push([u, v, 1 + rand(8)]);
            }
            const vertices = Array.from({ length: n }, (_, i) => `v${i}`);
            const input = {
                vertices,
                edges: edges.map(([u, v, w]) => [vertices[u], vertices[v], w]),
                source: vertices[0],
                sink: vertices[n - 1],
                insertions: insertions.map(([u, v, w]) => [vertices[u], vertices[v], w]),
            };
            const frames = [...mod.run(input)];
            checkFrames(frames, n);
            const finalEdges = edges.map(([u, v, w]) => [u, v, w] as E3);
            for (const [u, v, w] of insertions) {
                const match = finalEdges.find((e) => e[0] === u && e[1] === v);
                if (match) match[2] += w;
                else finalEdges.push([u, v, w]);
            }
            const expected = referenceMaxFlow(n, finalEdges, 0, n - 1);
            const last = frames[frames.length - 1] as VisualFrame;
            expect(last.meta["maxFlow"]).toBe(expected);
            expect(last.meta["insertionsProcessed"]).toBe(insertions.length);
        }
    });

    it("handles empty, singleton, and zero-capacity inputs", () => {
        expect([...mod.run(null)].length).toBe(1);
        expect([...mod.run({ vertices: ["A"] })].length).toBe(1);
        const frames = [...mod.run({
            vertices: ["A", "B"],
            edges: [["A", "B", 0]],
            source: "A",
            sink: "B",
            insertions: [],
        })];
        checkFrames(frames, 2);
        expect((frames[frames.length - 1] as VisualFrame).meta["maxFlow"]).toBe(0);
    });

    it("terminates cleanly on its default input and reports the increased flow", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames, 4);
        expect(generator.next().done).toBe(true);
        const last = frames[frames.length - 1] as VisualFrame;
        expect(Number(last.meta["augmentations"])).toBeGreaterThan(0);
        expect(Number(last.meta["insertionsProcessed"])).toBe(1);
        expect(Number(last.meta["maxFlow"])).toBeGreaterThan(0);
    });
});
