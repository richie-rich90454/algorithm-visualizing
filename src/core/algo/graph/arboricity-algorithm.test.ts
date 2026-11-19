/**
 * arboricity-algorithm.test.ts - Brute-force Nash-Williams check, frame shape,
 * and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./arboricity-algorithm";
import type { VisualFrame } from "@/types";

type Adj = Record<string, string[]>;

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

/** Independent reference: maximum over all subsets of ceil(E(S)/(|S|-1)). */
function bruteForceArboricity(adjacency: Adj): number {
    const vertices = Object.keys(adjacency).sort();
    const seen = new Set<string>();
    const edges: Array<[string, string]> = [];
    for (const a of vertices) {
        for (const raw of adjacency[a] ?? []) {
            const b = String(raw);
            if (!Object.prototype.hasOwnProperty.call(adjacency, b) || a === b) {
                continue;
            }
            const key = [a, b].sort().join("|");
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            edges.push([a, b]);
        }
    }
    let best = 0;
    for (let mask = 1; mask < 1 << vertices.length; mask += 1) {
        const subset = new Set(vertices.filter((_v, i) => (mask & (1 << i)) !== 0));
        if (subset.size < 2) {
            continue;
        }
        let internal = 0;
        for (const [a, b] of edges) {
            if (subset.has(a) && subset.has(b)) {
                internal += 1;
            }
        }
        best = Math.max(best, internal / (subset.size - 1));
    }
    return Math.ceil(best);
}

function densityOf(adjacency: Adj, subset: string[]): number {
    if (subset.length < 2) {
        return 0;
    }
    const members = new Set(subset);
    const seen = new Set<string>();
    let internal = 0;
    for (const a of subset) {
        for (const b of adjacency[a] ?? []) {
            if (!members.has(String(b))) {
                continue;
            }
            const key = [a, String(b)].sort().join("|");
            if (!seen.has(key)) {
                seen.add(key);
                internal += 1;
            }
        }
    }
    return internal / (subset.length - 1);
}

describe("Arboricity via Nash-Williams Density", () => {
    it("matches brute force on several small graphs", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { adjacency: Adj }).adjacency,
            { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["A", "B", "C"] },
            { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
            { A: ["B", "C"], B: ["A"], C: ["A"], D: [] },
        ];
        for (const adjacency of graphs) {
            const frames = [...mod.run({ adjacency })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["arboricity"]).toBe(bruteForceArboricity(adjacency));
            expect(meta?.["bestDensity"]).toBeGreaterThanOrEqual(0);
            expect(Number(meta?.["arboricity"])).toBe(Math.ceil(Number(meta?.["bestDensity"])));
            const witness = meta?.["bestSubset"] as string[];
            expect(densityOf(adjacency, witness)).toBeCloseTo(Number(meta?.["bestDensity"]), 10);
        }
    });

    it("handles an edgeless graph", () => {
        const frames = [...mod.run({ adjacency: { A: [], B: [], C: [] } })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["arboricity"]).toBe(0);
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
