/** seidel-apsp.test.ts - Independent BFS cross-check on all pairs, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./seidel-apsp";
import type { VisualFrame } from "@/types";

type Graph = Record<string, string[]>;

const INF = 1e9;

/** Independent breadth-first search from one source. */
function bfs(graph: Graph, source: string): Map<string, number> {
    const dist = new Map<string, number>([[source, 0]]);
    const queue = [source];
    while (queue.length > 0) {
        const u = queue.shift() as string;
        for (const v of graph[u] ?? []) {
            if (!dist.has(v)) {
                dist.set(v, (dist.get(u) as number) + 1);
                queue.push(v);
            }
        }
    }
    return dist;
}

function verticesOf(graph: Graph): string[] {
    const set = new Set<string>(Object.keys(graph));
    for (const list of Object.values(graph)) for (const v of list) set.add(v);
    return [...set];
}

function finalMeta(input: unknown): Record<string, unknown> {
    const frames = [...mod.run(input)];
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Seidel all-pairs shortest paths", () => {
    it("matches independent BFS distances on every pair", () => {
        const graphs: Graph[] = [
            { A: ["B", "C"], B: ["A", "D"], C: ["A", "D", "E"], D: ["B", "C", "F"], E: ["C", "F"], F: ["D", "E"] },
            { A: ["B"], B: ["A", "C"], C: ["B"] },
            { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["A", "B", "C"] },
            { A: ["B"], B: ["A"], C: ["D"], D: ["C"] },
            { A: [] },
        ];
        for (const graph of graphs) {
            const meta = finalMeta({ graph });
            const verts = verticesOf(graph);
            const actual = meta["distances"] as number[];
            expect(actual.length).toBe(verts.length * verts.length);
            for (let i = 0; i < verts.length; i += 1) {
                const reachable = bfs(graph, verts[i] as string);
                for (let j = 0; j < verts.length; j += 1) {
                    const expected = reachable.get(verts[j] as string) ?? INF;
                    expect(actual[i * verts.length + j]).toBe(expected);
                }
            }
        }
    });

    it("reports the number of squaring rounds", () => {
        const meta = finalMeta(mod.defaultInput);
        expect(meta["rounds"]).toBe(3);
        expect(meta["n"]).toBe(6);
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
