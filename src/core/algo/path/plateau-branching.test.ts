import { describe, expect, it } from "vitest";
import mod from "./plateau-branching";

type WAdj = Record<string, Array<[string, number]>>;

function rng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

/** Independent Dijkstra oracle for the cheapest path cost. */
function dijkstra(graph: WAdj, start: string, target: string): number {
    const dist: Record<string, number> = {};
    for (const v of Object.keys(graph)) dist[v] = Infinity;
    dist[start] = 0;
    const visited = new Set<string>();
    for (;;) {
        let u: string | null = null;
        let best = Infinity;
        for (const v of Object.keys(dist)) {
            if (!visited.has(v) && (dist[v] ?? Infinity) < best) {
                best = dist[v] as number;
                u = v;
            }
        }
        if (u === null || best === Infinity) break;
        visited.add(u);
        for (const [v, w] of graph[u] ?? []) {
            if (dist[v] === undefined) dist[v] = Infinity;
            if (best + w < (dist[v] as number)) dist[v] = best + w;
        }
    }
    return dist[target] ?? Infinity;
}

describe("plateau-branching", () => {
    it("finds optimal costs matching Dijkstra on random graphs", () => {
        for (let trial = 0; trial < 25; trial += 1) {
            const rand = rng(trial + 101);
            const names = ["A", "B", "C", "D", "E", "F"];
            const graph: WAdj = {};
            for (const v of names) graph[v] = [];
            for (const u of names) {
                for (const v of names) {
                    if (u !== v && rand() < 0.3) graph[u]?.push([v, 1 + Math.floor(rand() * 9)]);
                }
            }
            const frames = Array.from(mod.run({ graph, start: "A", target: "F", heuristic: {} }));
            const final = frames[frames.length - 1];
            const expected = dijkstra(graph, "A", "F");
            expect(final?.meta["cost"]).toBe(Number.isFinite(expected) ? expected : -1);
        }
    });

    it("returns a path whose edge weights sum to the reported cost", () => {
        const input = mod.defaultInput as { graph: WAdj; start: string; target: string };
        const frames = Array.from(mod.run(input));
        const final = frames[frames.length - 1];
        const path = String(final?.meta["path"]).split("→");
        let total = 0;
        for (let i = 0; i + 1 < path.length; i += 1) {
            const edge = (input.graph[path[i] as string] ?? []).find(([v]) => v === path[i + 1]);
            total += edge?.[1] ?? 0;
        }
        expect(path[0]).toBe(input.start);
        expect(path[path.length - 1]).toBe(input.target);
        expect(total).toBe(final?.meta["cost"]);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = Array.from(mod.run(mod.defaultInput));
        expect(frames.length).toBeGreaterThan(0);
        expect(frames.length).toBeLessThan(100);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(Array.isArray(frame.edges)).toBe(true);
            for (const edge of frame.edges) {
                expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
                expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
            }
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("graph");
            expect(frame.meta).toBeDefined();
        });
    });
});
