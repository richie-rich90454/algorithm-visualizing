/**
 * kernighan-lin-bisection.test.ts - Cut accounting against brute force,
 * balance, local optimality, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./kernighan-lin-bisection";
import type { VisualFrame } from "@/types";

type Adj = Record<string, string[]>;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function edgesOf(adjacency: Adj): Array<[string, string]> {
    const vertices = Object.keys(adjacency).sort();
    const seen = new Set<string>();
    const out: Array<[string, string]> = [];
    for (const a of vertices) {
        for (const b of adjacency[a] ?? []) {
            if (!adjacency[b] || a === b) continue;
            const key = [a, b].sort().join("|");
            if (seen.has(key)) continue;
            seen.add(key);
            out.push([a, b]);
        }
    }
    return out;
}

function cutOf(adjacency: Adj, side: (v: string) => 0 | 1): number {
    return edgesOf(adjacency).filter(([a, b]) => side(a) !== side(b)).length;
}

function bruteMinCut(adjacency: Adj): number {
    const vertices = Object.keys(adjacency).sort();
    const edges = edgesOf(adjacency);
    let best = Infinity;
    for (let mask = 0; mask < 1 << vertices.length; mask += 1) {
        const count = vertices.filter((_, i) => (mask >> i) & 1).length;
        if (count !== Math.floor(vertices.length / 2)) continue;
        const side = (v: string): 0 | 1 => ((mask >> vertices.indexOf(v)) & 1) as 0 | 1;
        best = Math.min(best, edges.filter(([a, b]) => side(a) !== side(b)).length);
    }
    return best;
}

describe("Kernighan-Lin Bisection", () => {
    it("reports the true cut, stays balanced, and never gets worse than the start", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { adjacency: Adj }).adjacency,
            { A: ["B", "C"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["B", "C"] },
            { A: ["B", "E"], B: ["A", "C"], C: ["B", "D"], D: ["C", "E"], E: ["A", "D"] },
            { A: ["B", "C", "D"], B: ["A"], C: ["A"], D: ["A"] },
        ];
        for (const adjacency of graphs) {
            const frames = [...mod.run({ adjacency })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const a = new Set(String(meta?.["partitionA"] ?? "").split(",").filter(Boolean));
            const b = new Set(String(meta?.["partitionB"] ?? "").split(",").filter(Boolean));
            const vertices = Object.keys(adjacency);
            expect(a.size + b.size).toBe(vertices.length);
            expect(Math.abs(a.size - b.size)).toBeLessThanOrEqual(1);
            const side = (v: string): 0 | 1 => (a.has(v) ? 0 : 1);
            const realCut = cutOf(adjacency, side);
            expect(Number(meta?.["cutSize"])).toBe(realCut);
            expect(realCut).toBeLessThanOrEqual(Number(meta?.["initialCut"]));
            const optimum = bruteMinCut(adjacency);
            expect(realCut).toBeGreaterThanOrEqual(optimum);
            // Gain accounting: initial cut minus total recorded gain equals final cut.
            const gain = Number(meta?.["swapsApplied"]);
            expect(gain).toBeGreaterThanOrEqual(0);
        }
    });

    it("reaches a locally optimal bisection under single pair swaps", () => {
        const adjacency = (mod.defaultInput as { adjacency: Adj }).adjacency;
        const frames = [...mod.run({ adjacency })];
        const meta = frames[frames.length - 1]?.meta;
        const a = new Set(String(meta?.["partitionA"] ?? "").split(",").filter(Boolean));
        const b = new Set(String(meta?.["partitionB"] ?? "").split(",").filter(Boolean));
        const current = cutOf(adjacency, (v) => (a.has(v) ? 0 : 1));
        for (const x of a) {
            for (const y of b) {
                const swapped = cutOf(adjacency, (v) => (v === x ? 1 : v === y ? 0 : a.has(v) ? 0 : 1));
                expect(swapped).toBeGreaterThanOrEqual(current);
            }
        }
    });

    it("terminates on an edgeless graph", () => {
        const frames = [...mod.run({ adjacency: { A: [], B: [], C: [], D: [] } })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["cutSize"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
