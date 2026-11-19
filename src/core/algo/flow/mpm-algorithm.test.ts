/** mpm-algorithm.test.ts - Independent Edmonds-Karp cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./mpm-algorithm";
import type { VisualFrame } from "@/types";

type CapGraph = Record<string, Record<string, number>>;

/** Independent Edmonds-Karp maximum flow. */
function edmondsKarp(graph: CapGraph, source: string, sink: string): number {
    const verts = new Set<string>(Object.keys(graph));
    for (const outgoing of Object.values(graph)) for (const v of Object.keys(outgoing)) verts.add(v);
    const list = [...verts];
    const idx = new Map(list.map((v, i) => [v, i]));
    const n = list.length;
    const cap: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
    for (const [u, outgoing] of Object.entries(graph)) {
        for (const [v, c] of Object.entries(outgoing)) {
            (cap[idx.get(u) as number] as number[])[idx.get(v) as number] += c;
        }
    }
    const s = idx.get(source) as number;
    const t = idx.get(sink) as number;
    let flow = 0;
    while (true) {
        const prev: number[] = Array<number>(n).fill(-1);
        prev[s] = s;
        const queue = [s];
        while (queue.length > 0 && prev[t] === -1) {
            const u = queue.shift() as number;
            for (let v = 0; v < n; v += 1) {
                if (prev[v] === -1 && (cap[u] as number[])[v] > 0) {
                    prev[v] = u;
                    queue.push(v);
                    if (v === t) break;
                }
            }
        }
        if (prev[t] === -1) break;
        let bottleneck = Infinity;
        let cursor = t;
        while (cursor !== s) {
            const p = prev[cursor] as number;
            bottleneck = Math.min(bottleneck, (cap[p] as number[])[cursor] as number);
            cursor = p;
        }
        cursor = t;
        while (cursor !== s) {
            const p = prev[cursor] as number;
            (cap[p] as number[])[cursor] -= bottleneck;
            (cap[cursor] as number[])[p] += bottleneck;
            cursor = p;
        }
        flow += bottleneck;
    }
    return flow;
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

describe("MPM maximum flow", () => {
    it("matches independent Edmonds-Karp on several networks", () => {
        const cases: Array<{ graph: CapGraph; source: string; sink: string }> = [
            {
                graph: {
                    s: { a: 3, b: 2 },
                    a: { b: 1, c: 2 },
                    b: { c: 1, t: 2 },
                    c: { a: 1, t: 3 },
                    t: {},
                },
                source: "s",
                sink: "t",
            },
            {
                graph: {
                    s: { a: 10, b: 5, c: 15 },
                    a: { d: 8, e: 4 },
                    b: { d: 3, e: 6 },
                    c: { e: 7 },
                    d: { t: 9 },
                    e: { t: 12 },
                    t: {},
                },
                source: "s",
                sink: "t",
            },
            {
                graph: {
                    A: { B: 4, C: 3 },
                    B: { D: 2 },
                    C: { B: 1, D: 5 },
                    D: {},
                },
                source: "A",
                sink: "D",
            },
            {
                graph: { s: { t: 7 }, t: {} },
                source: "s",
                sink: "t",
            },
        ];
        for (const c of cases) {
            const meta = finalMeta(c);
            expect(meta["flow"]).toBe(edmondsKarp(c.graph, c.source, c.sink));
            expect(typeof meta["iterations"]).toBe("number");
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
