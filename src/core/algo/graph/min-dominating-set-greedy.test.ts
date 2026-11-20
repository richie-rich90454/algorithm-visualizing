/** min-dominating-set-greedy.test.ts - Domination property vs brute force, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./min-dominating-set-greedy";

type Graph = Record<string, string[]>;

function collect(input: unknown) {
    return [...mod.run(input)];
}

function closedNeighborhood(graph: Graph, v: string): Set<string> {
    const set = new Set<string>([v]);
    for (const [u, vs] of Object.entries(graph)) {
        if (u === v) for (const w of vs) set.add(w);
        if (vs.includes(v)) set.add(u);
    }
    return set;
}

function allVertices(graph: Graph): string[] {
    return [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])].sort();
}

function dominates(graph: Graph, chosen: string[]): boolean {
    const covered = new Set<string>();
    for (const v of chosen) for (const w of closedNeighborhood(graph, v)) covered.add(w);
    return allVertices(graph).every((v) => covered.has(v));
}

function bruteForceMinimum(graph: Graph): number {
    const vertices = allVertices(graph);
    for (let size = 1; size <= vertices.length; size += 1) {
        const combinations: number[][] = [];
        const combine = (start: number, current: number[]): void => {
            if (current.length === size) {
                combinations.push([...current]);
                return;
            }
            for (let i = start; i <= vertices.length - (size - current.length); i += 1) {
                current.push(i);
                combine(i + 1, current);
                current.pop();
            }
        };
        combine(0, []);
        for (const combo of combinations) {
            if (dominates(graph, combo.map((i) => vertices[i]!))) return size;
        }
    }
    return vertices.length === 0 ? 0 : vertices.length;
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("MinDominatingSetGreedy", () => {
    it("yields well-formed frames on the default input and terminates", () => {
        const frames = collect(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(1);
        frames.forEach((f, index) => {
            expect(f.stepNumber).toBe(index);
            expect(f.description.length).toBeGreaterThanOrEqual(10);
            expect(f.layout).toBe("graph");
            expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(f.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(f.meta).toBeDefined();
            expect(f.entities.every((e) => e.type === "node")).toBe(true);
        });
    });

    it("always returns a valid dominating set on random graphs", () => {
        const rnd = seeded(8080);
        for (let t = 0; t < 120; t += 1) {
            const n = 1 + Math.floor(rnd() * 7);
            const vertices = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
            const graph: Graph = {};
            for (const v of vertices) graph[v] = [];
            for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                    if (rnd() < 0.4) {
                        graph[vertices[i]!]!.push(vertices[j]!);
                        graph[vertices[j]!]!.push(vertices[i]!);
                    }
                }
            }
            const frames = collect({ graph });
            const last = frames.at(-1)!;
            const chosen = (last.meta.chosen as string[]).filter((v): v is string => typeof v === "string");
            expect(dominates(graph, chosen)).toBe(true);
            expect(last.meta.size).toBe(chosen.length);
            expect(chosen.length).toBeGreaterThanOrEqual(bruteForceMinimum(graph));
            expect(chosen.length).toBeLessThanOrEqual(n);
        }
    });

    it("finds the optimum on a path and on a star", () => {
        const path: Graph = { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] };
        expect(collect({ graph: path }).at(-1)!.meta.size).toBe(2);
        const star: Graph = { C: ["A", "B", "D", "E"], A: ["C"], B: ["C"], D: ["C"], E: ["C"] };
        expect(collect({ graph: star }).at(-1)!.meta.size).toBe(1);
    });
});
