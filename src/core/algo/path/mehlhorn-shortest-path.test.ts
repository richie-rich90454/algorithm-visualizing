/**
 * mehlhorn-shortest-path.test.ts - Dijkstra cross-check and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./mehlhorn-shortest-path";
import type { VisualFrame } from "@/types";

type Graph = Record<string, Array<[string, number]>>;

function dijkstra(graph: Graph, start: string): Record<string, number> {
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flatMap((l) => l.map(([v]) => v))])];
    const dist = new Map(labels.map((v) => [v, Infinity]));
    const done = new Set<string>();
    dist.set(start, 0);
    for (;;) {
        let u: string | null = null;
        let best = Infinity;
        for (const v of labels) {
            if (!done.has(v) && (dist.get(v) ?? Infinity) < best) {
                best = dist.get(v) ?? Infinity;
                u = v;
            }
        }
        if (u === null) {
            break;
        }
        done.add(u);
        for (const [v, w] of graph[u] ?? []) {
            if ((dist.get(u) ?? Infinity) + w < (dist.get(v) ?? Infinity)) {
                dist.set(v, (dist.get(u) ?? Infinity) + w);
            }
        }
    }
    return Object.fromEntries(dist);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("graph");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Mehlhorn two-level bucket shortest path", () => {
    it("matches Dijkstra on the default graph", () => {
        const input = mod.defaultInput as { graph: Graph; start: string };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = dijkstra(input.graph, input.start);
        const final = frames[frames.length - 1]!.meta;
        const labels = Object.keys(expected);
        const distances = final["distances"] as number[];
        labels.forEach((v, i) => {
            const truth = expected[v] ?? Infinity;
            expect(distances[i]).toBe(Number.isFinite(truth) ? truth : -1);
        });
    });

    it("matches Dijkstra on random integer-weight graphs", () => {
        let seed = 67;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483647;
            return seed / 2147483647;
        };
        for (let t = 0; t < 10; t += 1) {
            const names = ["A", "B", "C", "D", "E", "F"].slice(0, 3 + Math.floor(rand() * 4));
            const graph: Graph = {};
            for (const u of names) {
                graph[u] = [];
                for (const v of names) {
                    if (u !== v && rand() < 0.5) {
                        graph[u]!.push([v, 1 + Math.floor(rand() * 7)]);
                    }
                }
            }
            const start = names[0]!;
            const frames = [...mod.run({ graph, start })];
            checkFrames(frames);
            const expected = dijkstra(graph, start);
            const distances = frames[frames.length - 1]!.meta["distances"] as number[];
            Object.keys(expected).forEach((v, i) => {
                const truth = expected[v] ?? Infinity;
                expect(distances[i]).toBe(Number.isFinite(truth) ? truth : -1);
            });
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
