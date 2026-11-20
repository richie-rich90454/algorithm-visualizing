/**
 * maximum-cardinality-search.test.ts - Correctness and frame-shape checks.
 */

import { describe, expect, it } from "vitest";
import mcs from "./maximum-cardinality-search";

function undirected(graph: Record<string, string[]>): Record<string, Set<string>> {
    const g: Record<string, Set<string>> = {};
    for (const v of Object.keys(graph)) {
        g[v] = new Set();
    }
    for (const [u, ns] of Object.entries(graph)) {
        g[u] ??= new Set();
        for (const v of ns) {
            g[u].add(v);
            g[v] ??= new Set();
            g[v].add(u);
        }
    }
    return g;
}

function isPeo(g: Record<string, Set<string>>, order: string[]): boolean {
    for (const v of order) {
        const later = [...(g[v] ?? [])].filter((n) => order.indexOf(n) > order.indexOf(v));
        for (let i = 0; i < later.length; i += 1) {
            for (let j = i + 1; j < later.length; j += 1) {
                if (!(g[later[i] as string] ?? new Set()).has(later[j] as string)) {
                    return false;
                }
            }
        }
    }
    return true;
}

function bruteChordal(graph: Record<string, string[]>): boolean {
    const verts = Object.keys(graph).sort();
    const g = undirected(graph);
    const perm: string[] = [];
    const used = new Set<string>();
    let found = false;
    const dfs = () => {
        if (found) {
            return;
        }
        if (perm.length === verts.length) {
            if (isPeo(g, perm)) {
                found = true;
            }
            return;
        }
        for (const v of verts) {
            if (!used.has(v)) {
                used.add(v);
                perm.push(v);
                dfs();
                perm.pop();
                used.delete(v);
            }
        }
    };
    dfs();
    return found;
}

function mcsOrder(graph: Record<string, string[]>): string[] {
    const g = undirected(graph);
    const verts = Object.keys(graph).sort();
    const numbered = new Set<string>();
    const order: string[] = [];
    while (order.length < verts.length) {
        let best: string | undefined;
        let bestCount = -1;
        for (const v of verts) {
            if (numbered.has(v)) {
                continue;
            }
            const count = [...(g[v] ?? [])].filter((n) => numbered.has(n)).length;
            if (count > bestCount) {
                bestCount = count;
                best = v;
            }
        }
        if (!best) {
            break;
        }
        numbered.add(best);
        order.push(best);
    }
    return order;
}

describe("MaximumCardinalitySearch", () => {
    it("produces the greedy maximum-count ordering matching an independent simulation", () => {
        const graphs = [
            { A: ["B", "C"], B: ["D"], C: ["B", "D"], D: [] },
            { A: ["B"], B: ["C"], C: ["D"], D: [] },
            { A: ["B", "C", "D"], B: ["C", "D"], C: ["D"], D: [] },
        ];
        for (const graph of graphs) {
            const frames = [...mcs.run({ graph })];
            const order = frames.at(-1)?.meta.order as string[];
            expect(order).toEqual(mcsOrder(graph));
            expect([...order].sort()).toEqual(Object.keys(graph).sort());
        }
    });

    it("decides chordality correctly against brute-force permutation search", () => {
        const graphs: Record<string, string[]>[] = [
            { A: ["B", "C"], B: ["D"], C: ["B", "D"], D: [] }, // chordal
            { A: ["B"], B: ["C"], C: ["D"], D: ["A"] }, // 4-cycle, not chordal
            { A: ["B", "C", "D"], B: ["C", "D"], C: ["D"], D: [] }, // K4 chordal
            { A: ["B", "C"], B: ["D"], C: ["D"], D: ["E"], E: ["A"] }, // cycle-ish
        ];
        for (const graph of graphs) {
            const frames = [...mcs.run({ graph })];
            expect(frames.at(-1)?.meta.chordal, JSON.stringify(graph)).toBe(bruteChordal(graph));
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mcs.run(mcs.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        for (let i = 0; i < frames.length; i += 1) {
            const frame = frames[i];
            expect(frame.stepNumber).toBe(i);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.layout).toBe("graph");
            expect(typeof frame.meta).toBe("object");
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber).toBeLessThan(mcs.pseudocode?.length ?? 0);
            for (const edge of frame.edges) {
                expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
                expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
            }
        }
    });
});
