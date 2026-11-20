/**
 * minimum-vertex-cover-approx.test.ts - Cover validity and the factor-of-two
 * bound against brute-force optimum, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./minimum-vertex-cover-approx";
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

function bruteOptimum(adjacency: Adj): number {
    const vertices = Object.keys(adjacency).sort();
    const edges = edgesOf(adjacency);
    let best = vertices.length;
    for (let mask = 0; mask < 1 << vertices.length; mask += 1) {
        const side = (v: string): boolean => ((mask >> vertices.indexOf(v)) & 1) !== 0;
        if (edges.every(([a, b]) => side(a) || side(b))) {
            best = Math.min(best, vertices.filter((v) => side(v)).length);
        }
    }
    return best;
}

describe("Minimum Vertex Cover Approximation", () => {
    it("returns a valid cover within twice the brute-force optimum", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { adjacency: Adj }).adjacency,
            { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
            { A: ["B", "C", "D"], B: ["A"], C: ["A"], D: ["A"] },
            { A: ["B", "C"], B: ["A", "C"], C: ["A", "B", "D"], D: ["C"] },
        ];
        for (const adjacency of graphs) {
            const frames = [...mod.run({ adjacency })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const cover = new Set((meta?.["cover"] as string[]) ?? []);
            for (const [a, b] of edgesOf(adjacency)) {
                expect(cover.has(a) || cover.has(b)).toBe(true);
            }
            expect(cover.size).toBe(Number(meta?.["coverSize"]));
            expect(cover.size).toBe(2 * Number(meta?.["matchingSize"]));
            expect(cover.size).toBeLessThanOrEqual(2 * bruteOptimum(adjacency));
        }
    });

    it("handles an edgeless graph", () => {
        const frames = [...mod.run({ adjacency: { A: [], B: [] } })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["coverSize"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
