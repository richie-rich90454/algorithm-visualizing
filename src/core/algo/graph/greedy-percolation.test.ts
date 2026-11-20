/**
 * greedy-percolation.test.ts - Modularity property checks against brute force.
 */

import { describe, expect, it } from "vitest";
import mod from "./greedy-percolation";
import type { VisualFrame } from "@/types";

type Edge = [string, string];

function modularity(nodes: string[], edges: Edge[], labelOf: (v: string) => number): number {
    const m = edges.length;
    if (m === 0) {
        return 0;
    }
    const degree = new Map(nodes.map((v) => [v, 0]));
    const internal = new Map<number, number>();
    const commDegree = new Map<number, number>();
    for (const [u, v] of edges) {
        degree.set(u, (degree.get(u) ?? 0) + 1);
        degree.set(v, (degree.get(v) ?? 0) + 1);
    }
    for (const v of nodes) {
        const c = labelOf(v);
        commDegree.set(c, (commDegree.get(c) ?? 0) + (degree.get(v) ?? 0));
    }
    for (const [u, v] of edges) {
        if (labelOf(u) === labelOf(v)) {
            const c = labelOf(u);
            internal.set(c, (internal.get(c) ?? 0) + 1);
        }
    }
    let q = 0;
    for (const c of commDegree.keys()) {
        q += (internal.get(c) ?? 0) / m - ((commDegree.get(c) ?? 0) / (2 * m)) ** 2;
    }
    return q;
}

/** Exhaustively maximize modularity over all set partitions (small graphs). */
function bruteMax(nodes: string[], edges: Edge[]): number {
    let best = -Infinity;
    const labels = new Map<string, number>();
    const visit = (i: number, groups: number): void => {
        if (i === nodes.length) {
            best = Math.max(best, modularity(nodes, edges, (v) => labels.get(v) ?? 0));
            return;
        }
        for (let c = 0; c <= groups; c += 1) {
            labels.set(nodes[i]!, c);
            visit(i + 1, Math.max(groups, c + 1));
        }
        labels.delete(nodes[i]!);
    };
    visit(0, 0);
    return best;
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

describe("Greedy percolation community detection", () => {
    it("stays within the brute-force modularity bounds and never decreases", () => {
        const input = mod.defaultInput as { edges: Edge[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const nodes = [...new Set(input.edges.flat())];
        const initial = Number(frames[0]!.meta["q"]);
        const final = Number(frames[frames.length - 1]!.meta["q"]);
        const best = bruteMax(nodes, input.edges);
        expect(final).toBeGreaterThanOrEqual(initial - 1e-9);
        expect(final).toBeLessThanOrEqual(best + 1e-9);
        for (let i = 1; i < frames.length; i += 1) {
            expect(Number(frames[i]!.meta["q"])).toBeGreaterThanOrEqual(Number(frames[i - 1]!.meta["q"]) - 1e-9);
        }
    });

    it("produces a valid partition whose reported score is reproducible", () => {
        const input = mod.defaultInput as { edges: Edge[] };
        const frames = [...mod.run(input)];
        const nodes = [...new Set(input.edges.flat())];
        const final = frames[frames.length - 1]!.meta;
        const communities = final["communities"] as number[];
        expect(communities.length).toBe(nodes.length);
        const labelOf = (v: string): number => communities[nodes.indexOf(v)] ?? -1;
        expect(communities.every((c) => c >= 0)).toBe(true);
        expect(modularity(nodes, input.edges, labelOf)).toBeCloseTo(Number(final["q"]), 5);
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
