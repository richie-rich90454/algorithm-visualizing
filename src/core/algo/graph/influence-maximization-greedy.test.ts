/** influence-maximization-greedy.test.ts - Greedy guarantee vs exact spread. */

import { describe, expect, it } from "vitest";
import mod from "./influence-maximization-greedy";
import type { VisualFrame } from "@/types";

type Graph = Record<string, Array<[string, number]>>;

const defaultGraph: Graph = (mod.defaultInput as { graph?: Graph }).graph ?? {
    A: [["B", 0.6], ["C", 0.6], ["D", 0.6]],
    B: [["E", 0.4]],
    C: [["F", 0.4]],
    D: [["G", 0.4]],
    E: [],
    F: [],
    G: [],
};

/** Exact expected cascade size by enumerating outcomes of each edge once. */
function exactSpread(graph: Graph, seeds: string[]): number {
    const edgeList: Array<[string, string, number]> = [];
    for (const [u, neighbors] of Object.entries(graph)) {
        for (const [v, p] of neighbors) {
            edgeList.push([u, v, p]);
        }
    }
    const rec = (processed: Set<number>, active: Set<string>): number => {
        let index = -1;
        for (let i = 0; i < edgeList.length; i += 1) {
            const [u] = edgeList[i] as [string, string, number];
            if (!processed.has(i) && active.has(u)) {
                index = i;
                break;
            }
        }
        if (index === -1) {
            return active.size;
        }
        const [u, v, p] = edgeList[index] as [string, string, number];
        processed.add(index);
        if (active.has(v)) {
            const result = rec(processed, active);
            processed.delete(index);
            return result;
        }
        const activated = new Set(active);
        activated.add(v);
        const result = p * rec(processed, activated) + (1 - p) * rec(processed, active);
        processed.delete(index);
        return result;
    };
    return rec(new Set<number>(), new Set(seeds));
}

function bestExact(graph: Graph, k: number): number {
    const labels = Object.keys(graph);
    let best = -1;
    const choose = (start: number, picked: string[]): void => {
        if (picked.length === k) {
            best = Math.max(best, exactSpread(graph, picked));
            return;
        }
        for (let i = start; i < labels.length; i += 1) {
            picked.push(labels[i] as string);
            choose(i + 1, picked);
            picked.pop();
        }
    };
    choose(0, []);
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
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

describe("InfluenceMaximizationGreedy", () => {
    it("picks the dominant seed and meets the submodular approximation bound", () => {
        const frames = [...mod.run({ graph: defaultGraph, k: 2, samples: 400, seed: 42 })];
        checkFrames(frames);
        const last = frames[frames.length - 1] as VisualFrame;
        const chosen = last.meta["chosen"] as string[];
        expect(chosen).toHaveLength(2);
        expect(chosen[0]).toBe("A");
        expect(exactSpread(defaultGraph, chosen)).toBeGreaterThanOrEqual(0.6 * bestExact(defaultGraph, 2));
        expect(Number(last.meta["spread"])).toBeGreaterThan(0);
        expect(Number(last.meta["spread"])).toBeLessThanOrEqual(Object.keys(defaultGraph).length);
    });

    it("handles k equals zero and terminates cleanly", () => {
        const generator = mod.run({ graph: defaultGraph, k: 0, samples: 10, seed: 1 });
        const frames = [...generator];
        checkFrames(frames);
        expect(generator.next().done).toBe(true);
        expect((frames[frames.length - 1] as VisualFrame).meta["chosen"]).toEqual([]);
    });

    it("is deterministic for a fixed seed", () => {
        const a = [...mod.run({ graph: defaultGraph, k: 2, samples: 50, seed: 7 })];
        const b = [...mod.run({ graph: defaultGraph, k: 2, samples: 50, seed: 7 })];
        expect(a[a.length - 1]?.meta["chosen"]).toEqual(b[b.length - 1]?.meta["chosen"]);
    });
});
