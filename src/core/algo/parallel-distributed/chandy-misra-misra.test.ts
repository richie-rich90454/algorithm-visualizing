/**
 * chandy-misra-misra.test.ts - Brute-force reachability verdict, probe
 * termination, frame shape, and generator termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./chandy-misra-misra";
import type { VisualFrame } from "@/types";

type Edge = [string, string];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

/** Independent reachability: can start reach itself via at least one edge? */
function bruteInCycle(start: string, nodes: string[], edges: Edge[]): boolean {
    const adj = new Map<string, string[]>(nodes.map((n) => [n, []]));
    for (const [a, b] of edges) if (adj.has(a)) (adj.get(a) as string[]).push(b);
    const seen = new Set<string>();
    const stack = [...(adj.get(start) ?? [])];
    while (stack.length > 0) {
        const v = stack.pop() as string;
        if (v === start) return true;
        if (seen.has(v)) continue;
        seen.add(v);
        stack.push(...(adj.get(v) ?? []));
    }
    return false;
}

function seeded(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 1103515245 + 12345) >>> 0;
        return s / 0x100000000;
    };
}

describe("ChandyMisraMisra", () => {
    it("matches brute-force cycle membership for every initiator", () => {
        const rand = seeded(11);
        for (let trial = 0; trial < 60; trial += 1) {
            const n = 3 + Math.floor(rand() * 3);
            const nodes = Array.from({ length: n }, (_, i) => `P${i}`);
            const edges: Edge[] = [];
            for (let i = 0; i < n; i += 1) {
                for (let j = 0; j < n; j += 1) {
                    if (i !== j && rand() < 0.32) edges.push([nodes[i] as string, nodes[j] as string]);
                }
            }
            for (const initiator of nodes) {
                const frames = [...mod.run({ processes: nodes, waits: edges, initiator })];
                checkFrames(frames);
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["deadlock"]).toBe(bruteInCycle(initiator, nodes, edges));
                expect(Number(final?.["probes"])).toBeLessThanOrEqual(edges.length * n + 1);
            }
        }
    });

    it("detects the default cycle and misses a non-member", () => {
        const deadlocked = [...mod.run(mod.defaultInput)];
        checkFrames(deadlocked);
        expect(deadlocked[deadlocked.length - 1]?.meta["deadlock"]).toBe(true);
        const frames = [...mod.run({ ...(mod.defaultInput as object), initiator: "P3" })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["deadlock"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
