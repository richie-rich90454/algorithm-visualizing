/**
 * max-independent-set-branch.test.ts - Brute-force optimality check, frame
 * shape validation, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./max-independent-set-branch";
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

function adjacency(graph: Graph): Map<string, Set<string>> {
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])];
    const map = new Map<string, Set<string>>(labels.map((label) => [label, new Set<string>()]));
    for (const [u, vs] of Object.entries(graph)) {
        for (const v of vs) {
            map.get(u)?.add(v);
            map.get(v)?.add(u);
        }
    }
    return map;
}

/** Independent reference: try every subset and keep the largest independent one. */
function bruteForce(graph: Graph): number {
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])];
    const adj = adjacency(graph);
    let best = 0;
    for (let mask = 0; mask < 1 << labels.length; mask += 1) {
        const subset = labels.filter((_label, i) => Boolean(mask & (1 << i)));
        let independent = true;
        for (const u of subset) {
            for (const v of subset) {
                if (u !== v && adj.get(u)?.has(v)) {
                    independent = false;
                }
            }
        }
        if (independent && subset.length > best) {
            best = subset.length;
        }
    }
    return best;
}

describe("Maximum Independent Set (Branch and Bound)", () => {
    const graphs: Graph[] = [
        {
            A: ["B", "C"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D"],
            D: ["B", "C", "E"],
            E: ["D", "F"],
            F: ["E"],
            G: [],
        },
        { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
        { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
        { A: [], B: [], C: [], D: [] },
        { A: ["B"], B: ["A"] },
    ];

    it("finds the brute-force maximum on several graphs", () => {
        for (const graph of graphs) {
            const frames = [...mod.run({ graph })];
            checkFrames(frames);
            const last = frames[frames.length - 1]?.meta;
            expect(Number(last?.["bestSize"])).toBe(bruteForce(graph));
        }
    });

    it("returns a valid independent set of the reported size", () => {
        const graph = graphs[0] as Graph;
        const adj = adjacency(graph);
        const frames = [...mod.run({ graph })];
        const last = frames[frames.length - 1]?.meta;
        const bestSet = last?.["bestSet"] as string[];
        expect(bestSet).toHaveLength(Number(last?.["bestSize"]));
        for (const u of bestSet) {
            for (const v of bestSet) {
                if (u !== v) {
                    expect(adj.get(u)?.has(v)).toBe(false);
                }
            }
        }
    });

    it("handles empty and single-vertex graphs", () => {
        const empty = [...mod.run({ graph: {} })];
        checkFrames(empty);
        expect(Number(empty[empty.length - 1]?.meta["bestSize"])).toBe(0);

        const single = [...mod.run({ graph: { A: [] } })];
        checkFrames(single);
        expect(Number(single[single.length - 1]?.meta["bestSize"])).toBe(1);
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
