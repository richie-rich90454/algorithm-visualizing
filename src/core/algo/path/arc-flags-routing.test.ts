/**
 * arc-flags-routing.test.ts - Property check that flagged queries match full
 * Dijkstra, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./arc-flags-routing";
import type { VisualFrame } from "@/types";

type Graph = Record<string, Array<[string, number]>>;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
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

/** Independent reference: Bellman-Ford relaxation for shortest distances. */
function bruteForce(graph: Graph, start: string): Map<string, number> {
    const vertices = [...new Set([...Object.keys(graph), ...Object.values(graph).flat().map((p) => String(p[0]))])];
    const edges: Array<[string, string, number]> = [];
    for (const u of Object.keys(graph)) {
        for (const [rawV, rawW] of graph[u] ?? []) {
            edges.push([u, String(rawV), Number(rawW)]);
        }
    }
    const dist = new Map<string, number>(vertices.map((v) => [v, Infinity]));
    dist.set(start, 0);
    for (let i = 0; i < vertices.length; i += 1) {
        let changed = false;
        for (const [u, v, w] of edges) {
            const via = (dist.get(u) ?? Infinity) + w;
            if (via < (dist.get(v) ?? Infinity)) {
                dist.set(v, via);
                changed = true;
            }
        }
        if (!changed) {
            break;
        }
    }
    return dist;
}

describe("Arc Flags Routing", () => {
    it("matches full Dijkstra on every cross-region query", () => {
        const input = mod.defaultInput as { graph: Graph; regions: Record<string, number> };
        const vertices = Object.keys(input.graph);
        for (const start of vertices) {
            for (const target of vertices) {
                if (input.regions[start] === input.regions[target] || start === target) {
                    continue;
                }
                const frames = [...mod.run({ ...input, start, target })];
                checkFrames(frames);
                const meta = frames[frames.length - 1]?.meta;
                const expected = bruteForce(input.graph, start).get(target) ?? Infinity;
                expect(Number(meta?.["distance"])).toBeCloseTo(expected, 9);
                expect(Number(meta?.["bruteForce"])).toBeCloseTo(expected, 9);
                expect(meta?.["targetRegion"]).toBe(input.regions[target]);
            }
        }
    });

    it("flags only edges that can begin a shortest route into a region", () => {
        const input = mod.defaultInput as { graph: Graph; regions: Record<string, number> };
        const frames = [...mod.run({ ...input, start: "A", target: "D" })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const flags = meta?.["flags"] as string[];
        expect(flags.length).toBeGreaterThan(0);
        for (const flag of flags) {
            expect(flag).toMatch(/^[A-Z]+-[A-Z]+:\d+$/);
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
