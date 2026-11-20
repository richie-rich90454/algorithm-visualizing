/**
 * d-star-plus.test.ts - Repaired cost checked against Dijkstra on the changed
 * graph, path validity, local work, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./d-star-plus";
import type { VisualFrame } from "@/types";

type WAdj = Record<string, Array<[string, number]>>;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function dijkstra(graph: WAdj, start: string, target: string): number {
    const vertices = new Set([
        ...Object.keys(graph),
        ...Object.values(graph).flatMap((pairs) => pairs.map(([v]) => v)),
    ]);
    const dist = new Map<string, number>([...vertices].map((v) => [v, Infinity]));
    dist.set(start, 0);
    const done = new Set<string>();
    for (;;) {
        let u: string | undefined;
        let best = Infinity;
        for (const v of vertices) {
            if (!done.has(v) && (dist.get(v) as number) < best) {
                best = dist.get(v) as number;
                u = v;
            }
        }
        if (u === undefined || u === target) break;
        done.add(u);
        for (const [v, w] of graph[u] ?? []) {
            const nd = (dist.get(u) as number) + w;
            if (nd < (dist.get(v) as number)) dist.set(v, nd);
        }
    }
    return dist.get(target) as number;
}

function applyChange(graph: WAdj, change: [string, string, number]): WAdj {
    const copy: WAdj = {};
    for (const [k, pairs] of Object.entries(graph)) copy[k] = pairs.map((p) => [p[0], p[1]]);
    const [u, v, w] = change;
    for (const pair of copy[u] ?? []) if (pair[0] === v) pair[1] = w;
    for (const pair of copy[v] ?? []) if (pair[0] === u) pair[1] = w;
    return copy;
}

function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

describe("D* Plus Incremental Replanning", () => {
    it("matches a full Dijkstra replan after an edge cost change on random graphs", () => {
        for (let seed = 1; seed <= 25; seed += 1) {
            const next = rng(seed);
            const n = 6;
            const graph: WAdj = {};
            for (let i = 0; i < n; i += 1) graph[String.fromCharCode(65 + i)] = [];
            for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                    if (next() < 0.5) {
                        const w = 1 + Math.floor(next() * 9);
                        graph[String.fromCharCode(65 + i)]?.push([String.fromCharCode(65 + j), w]);
                        graph[String.fromCharCode(65 + j)]?.push([String.fromCharCode(65 + i), w]);
                    }
                }
            }
            const existing: Array<[string, string]> = [];
            for (const [a, pairs] of Object.entries(graph))
                for (const [b] of pairs) if (a < b) existing.push([a, b]);
            if (existing.length === 0) continue;
            const [u, v] = existing[Math.floor(next() * existing.length)] as [string, string];
            const change: [string, string, number] = [u, v, 1 + Math.floor(next() * 12)];
            const frames = [...mod.run({ graph, start: "A", target: "F", change })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const got = Number(meta?.["cost"]);
            const want = dijkstra(applyChange(graph, change), "A", "F");
            expect(got).toBe(Number.isFinite(want) ? want : -1);
            expect(Number(meta?.["repaired"])).toBeLessThanOrEqual(Number(meta?.["fullSize"]));
        }
    });

    it("reports a path whose edge weights sum to the repaired cost", () => {
        const input = mod.defaultInput as { graph: WAdj; start: string; target: string; change: [string, string, number] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const path = String(meta?.["path"] ?? "").split(">");
        expect(path[0]).toBe("A");
        expect(path[path.length - 1]).toBe("E");
        const changed = applyChange(input.graph, input.change);
        let cost = 0;
        for (let i = 0; i + 1 < path.length; i += 1) {
            const pair = (changed[path[i] as string] ?? []).find(([v]) => v === path[i + 1]);
            expect(pair).toBeDefined();
            cost += pair?.[1] ?? 0;
        }
        expect(cost).toBe(Number(meta?.["cost"]));
    });

    it("is deterministic and terminates on an empty graph", () => {
        const input = mod.defaultInput;
        expect([...mod.run(input)].at(-1)?.meta["cost"]).toBe([...mod.run(input)].at(-1)?.meta["cost"]);
        const frames = [...mod.run({ graph: {} })];
        checkFrames(frames);
        expect(frames[0]?.meta["repaired"]).toBe(0);
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
