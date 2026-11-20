/**
 * densest-subgraph.test.ts - Independent brute-force optimality check,
 * frame shape validation, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./densest-subgraph";
import type { VisualFrame } from "@/types";

type Graph = Record<string, string[]>;

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

/** Independent reference: enumerate all subsets and count induced edges. */
function bruteForce(graph: Graph, kInput: number): { count: number; subset: string[] } {
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])].sort();
    const k = Math.max(0, Math.min(labels.length, Math.floor(kInput)));
    const pairs: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const [u, neighbors] of Object.entries(graph)) {
        for (const v of neighbors) {
            if (u === v) {
                continue;
            }
            const key = u < v ? `${u}|${v}` : `${v}|${u}`;
            if (!seen.has(key)) {
                seen.add(key);
                pairs.push([u < v ? u : v, u < v ? v : u]);
            }
        }
    }
    let best = -1;
    let bestSubset: string[] = [];
    for (let mask = 0; mask < 1 << labels.length; mask += 1) {
        let bits = 0;
        for (let i = 0; i < labels.length; i += 1) {
            if (mask & (1 << i)) {
                bits += 1;
            }
        }
        if (bits !== k) {
            continue;
        }
        const subset = labels.filter((_label, i) => Boolean(mask & (1 << i)));
        const inSubset = new Set(subset);
        let count = 0;
        for (const [a, b] of pairs) {
            if (inSubset.has(a) && inSubset.has(b)) {
                count += 1;
            }
        }
        if (count > best) {
            best = count;
            bestSubset = subset;
        }
    }
    return { count: Math.max(0, best), subset: bestSubset };
}

describe("Densest k-Subgraph", () => {
    const graphs: Graph[] = [
        {
            A: ["B", "C", "D"],
            B: ["A", "C"],
            C: ["A", "B", "D", "E"],
            D: ["A", "C", "E"],
            E: ["C", "D"],
            F: [],
        },
        { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"], D: [] },
        { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
        { A: ["B", "C", "D", "E"], B: ["A"], C: ["A"], D: ["A"], E: ["A"] },
    ];

    it("matches brute force on several graphs and k values", () => {
        for (const graph of graphs) {
            for (const k of [0, 1, 2, 3, 4, 8]) {
                const frames = [...mod.run({ graph, k })];
                checkFrames(frames);
                const expected = bruteForce(graph, k);
                const last = frames[frames.length - 1]?.meta;
                expect(Number(last?.["bestEdges"])).toBe(expected.count);
                const subset = last?.["bestSubset"] as string[];
                expect(subset).toHaveLength(expected.subset.length);
                const inSubset = new Set(subset);
                let induced = 0;
                const seen = new Set<string>();
                for (const [u, neighbors] of Object.entries(graph)) {
                    for (const v of neighbors) {
                        const key = u < v ? `${u}|${v}` : `${v}|${u}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            if (inSubset.has(u) && inSubset.has(v)) {
                                induced += 1;
                            }
                        }
                    }
                }
                expect(induced).toBe(expected.count);
            }
        }
    });

    it("reports the correct density", () => {
        const graph = graphs[0] as Graph;
        const frames = [...mod.run({ graph, k: 3 })];
        const last = frames[frames.length - 1]?.meta;
        const bestEdges = Number(last?.["bestEdges"]);
        expect(Number(last?.["bestDensity"])).toBeCloseTo(bestEdges / 3, 9);
    });

    it("handles an empty graph", () => {
        const frames = [...mod.run({ graph: {}, k: 2 })];
        checkFrames(frames);
        const last = frames[frames.length - 1]?.meta;
        expect(Number(last?.["bestEdges"])).toBe(0);
        expect(last?.["bestSubset"]).toEqual([]);
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
