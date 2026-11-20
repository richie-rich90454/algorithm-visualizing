/**
 * distributed-deadlock-detection.test.ts - Independent cycle detection,
 * residual acyclicity, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./distributed-deadlock-detection";
import type { VisualFrame } from "@/types";

type Edge = [string, string];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.length).toBeGreaterThan(0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

/** Brute force: a node is in a cycle iff it can reach itself through edges. */
function cycleNodes(nodes: string[], edges: Edge[]): Set<string> {
    const adj = new Map<string, string[]>(nodes.map((n) => [n, []]));
    for (const [a, b] of edges) if (adj.has(a)) (adj.get(a) as string[]).push(b);
    const result = new Set<string>();
    for (const start of nodes) {
        const seen = new Set<string>();
        const stack = [...(adj.get(start) ?? [])];
        while (stack.length > 0) {
            const v = stack.pop() as string;
            if (v === start) {
                result.add(start);
                break;
            }
            if (seen.has(v)) continue;
            seen.add(v);
            stack.push(...(adj.get(v) ?? []));
        }
    }
    return result;
}

/** Kahn topological-sort acyclicity test. */
function acyclic(nodes: string[], edges: Edge[]): boolean {
    const indegree = new Map<string, number>(nodes.map((n) => [n, 0]));
    const adj = new Map<string, string[]>(nodes.map((n) => [n, []]));
    for (const [a, b] of edges) {
        if (!indegree.has(b)) continue;
        indegree.set(b, (indegree.get(b) as number) + 1);
        (adj.get(a) ?? []).push(b);
    }
    const queue = nodes.filter((n) => indegree.get(n) === 0);
    let removed = 0;
    while (queue.length) {
        const v = queue.shift() as string;
        removed += 1;
        for (const w of adj.get(v) ?? []) {
            const d = (indegree.get(w) as number) - 1;
            indegree.set(w, d);
            if (d === 0) queue.push(w);
        }
    }
    return removed === nodes.length;
}

function seeded(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

describe("DistributedDeadlockDetection", () => {
    it("finds exactly the nodes in cycles and returns an acyclic residual graph", () => {
        const rand = seeded(7);
        for (let trial = 0; trial < 60; trial += 1) {
            const n = 3 + Math.floor(rand() * 3);
            const nodes = Array.from({ length: n }, (_, i) => `P${i}`);
            const edges: Edge[] = [];
            for (let i = 0; i < n; i += 1) {
                for (let j = 0; j < n; j += 1) {
                    if (i !== j && rand() < 0.3) edges.push([nodes[i] as string, nodes[j] as string]);
                }
            }
            const frames = [...mod.run({ processes: nodes, sites: nodes.map((_, i) => i % 2), waits: edges })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["deadlockFree"]).toBe(true);
            const victims = final?.["victims"] as string[];
            const initialCycles = cycleNodes(nodes, edges);
            const expectedDetection = initialCycles.size > 0;
            expect(victims.length > 0).toBe(expectedDetection);
            expect(Number(final?.["cycles"]) > 0).toBe(expectedDetection);
            for (const victim of victims) expect(initialCycles.has(victim)).toBe(true);
            const residual = edges.filter(([a, b]) => !victims.includes(a) && !victims.includes(b));
            const survivors = nodes.filter((x) => !victims.includes(x));
            expect(acyclic(survivors, residual)).toBe(true);
        }
    });

    it("reports no victims for an acyclic wait-for graph", () => {
        const frames = [...mod.run({ processes: ["A", "B", "C"], waits: [["A", "B"], ["B", "C"]] })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["victims"]).toEqual([]);
        expect(final?.["cycles"]).toBe(0);
        expect(final?.["deadlockFree"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
