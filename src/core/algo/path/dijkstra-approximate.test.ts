/**
 * dijkstra-approximate.test.ts - Distortion bound checked against exact
 * Dijkstra, path-length validity, frame shape, determinism, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./dijkstra-approximate";
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

function exactDistances(graph: WAdj, start: string): Map<string, number> {
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
        if (u === undefined) break;
        done.add(u);
        for (const [v, w] of graph[u] ?? []) {
            const nd = (dist.get(u) as number) + w;
            if (nd < (dist.get(v) as number)) dist.set(v, nd);
        }
    }
    return dist;
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

function randomGraph(seed: number, n: number): WAdj {
    const next = rng(seed);
    const graph: WAdj = {};
    for (let i = 0; i < n; i += 1) graph[String.fromCharCode(65 + i)] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            if (next() < 0.45) {
                const w = 1 + Math.floor(next() * 12);
                graph[String.fromCharCode(65 + i)]?.push([String.fromCharCode(65 + j), w]);
                graph[String.fromCharCode(65 + j)]?.push([String.fromCharCode(65 + i), w]);
            }
        }
    }
    return graph;
}

describe("Approximate Dijkstra ((1+epsilon) Buckets)", () => {
    it("returns real path lengths within the (1+epsilon) factor on random graphs", () => {
        for (let seed = 1; seed <= 25; seed += 1) {
            const graph = randomGraph(seed, 6);
            const exact = exactDistances(graph, "A");
            for (const epsilon of [0.3, 0.5, 1]) {
                const frames = [...mod.run({ graph, start: "A", target: "F", epsilon })];
                checkFrames(frames);
                const meta = frames[frames.length - 1]?.meta;
                const labels = meta?.["labels"] as string[];
                const estimates = meta?.["estimates"] as number[];
                expect(labels.length).toBe(estimates.length);
                for (let i = 0; i < labels.length; i += 1) {
                    const v = labels[i] as string;
                    const got = estimates[i] as number;
                    const want = exact.get(v) as number;
                    if (!Number.isFinite(want)) {
                        expect(got).toBe(-1);
                        continue;
                    }
                    expect(got).toBeGreaterThanOrEqual(want - 1e-9);
                    expect(got).toBeLessThanOrEqual((1 + epsilon) * want + 1e-6);
                }
            }
        }
    });

    it("reports a path whose edge weights sum to the target estimate", () => {
        const input = mod.defaultInput as { graph: WAdj; start: string; target: string; epsilon: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const path = String(meta?.["path"] ?? "").split(">");
        expect(path[0]).toBe("A");
        expect(path[path.length - 1]).toBe("F");
        let cost = 0;
        for (let i = 0; i + 1 < path.length; i += 1) {
            const pair = (input.graph[path[i] as string] ?? []).find(([v]) => v === path[i + 1]);
            expect(pair).toBeDefined();
            cost += pair?.[1] ?? 0;
        }
        expect(cost).toBe(Number(meta?.["targetDistance"]));
    });

    it("is deterministic and terminates on an empty graph", () => {
        const input = mod.defaultInput;
        expect([...mod.run(input)].at(-1)?.meta["targetDistance"]).toBe(
            [...mod.run(input)].at(-1)?.meta["targetDistance"],
        );
        const frames = [...mod.run({ graph: {} })];
        checkFrames(frames);
        expect(frames[0]?.meta["settled"]).toBe(0);
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
