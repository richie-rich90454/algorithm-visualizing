/**
 * nucleus-decomposition.test.ts - Brute force, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./nucleus-decomposition";
import type { VisualFrame } from "@/types";

type Adj = Map<string, Set<string>>;

function build(graph: Record<string, string[]>): { labels: string[]; adj: Adj } {
    const seen = new Set<string>(Object.keys(graph));
    for (const neighbors of Object.values(graph)) for (const v of neighbors) seen.add(v);
    const labels = [...seen].sort();
    const adj: Adj = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [u, neighbors] of Object.entries(graph)) {
        for (const v of neighbors) {
            if (u === v) continue;
            adj.get(u)?.add(v);
            adj.get(v)?.add(u);
        }
    }
    return { labels, adj };
}

function countCliques(v: string, subset: Set<string>, adj: Adj, r: number): number {
    if (r < 2) return 0;
    const others = [...subset].filter((x) => x !== v);
    let count = 0;
    const combo: string[] = [];
    const choose = (start: number): void => {
        if (combo.length === r - 1) {
            const group = [v, ...combo];
            for (let i = 0; i < group.length; i += 1) {
                for (let j = i + 1; j < group.length; j += 1) {
                    if (!adj.get(group[i] as string)?.has(group[j] as string)) return;
                }
            }
            count += 1;
            return;
        }
        for (let i = start; i < others.length; i += 1) {
            combo.push(others[i] as string);
            choose(i + 1);
            combo.pop();
        }
    };
    choose(0);
    return count;
}

/** The union of every valid subset is the unique maximal (k, r)-nucleus. */
function bruteNucleus(k: number, r: number, labels: string[], adj: Adj): string[] {
    const union = new Set<string>();
    const full = 1 << labels.length;
    for (let mask = 0; mask < full; mask += 1) {
        const subset = new Set<string>();
        for (let i = 0; i < labels.length; i += 1) {
            if (mask & (1 << i)) subset.add(labels[i] as string);
        }
        if (subset.size === 0) continue;
        let ok = true;
        for (const v of subset) {
            if (countCliques(v, subset, adj, r) < k) { ok = false; break; }
        }
        if (ok) for (const v of subset) union.add(v);
    }
    return [...union].sort();
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    const nodeIds = new Set<string>();
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.length).toBeGreaterThan(0);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("node");
            nodeIds.add(entity.id);
        }
    });
    for (const frame of frames) {
        for (const edge of frame.edges) {
            expect(nodeIds.has(edge.sourceId)).toBe(true);
            expect(nodeIds.has(edge.targetId)).toBe(true);
        }
    }
}

describe("Nucleus decomposition", () => {
    it("matches exhaustive nucleus search on small random graphs", () => {
        let seed = 4242;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x80000000;
        };
        for (let trial = 0; trial < 24; trial += 1) {
            const n = 3 + (trial % 5);
            const labels = Array.from({ length: n }, (_, i) => `v${i}`);
            const graph: Record<string, string[]> = {};
            for (let i = 0; i < n; i += 1) graph[labels[i] as string] = [];
            for (let i = 0; i < n; i += 1) {
                for (let j = i + 1; j < n; j += 1) {
                    if (rand() < 0.55) {
                        graph[labels[i] as string]?.push(labels[j] as string);
                        graph[labels[j] as string]?.push(labels[i] as string);
                    }
                }
            }
            const { labels: sorted, adj } = build(graph);
            const r = 2 + (trial % 3);
            const k = 1 + (trial % 3);
            const frames = [...mod.run({ graph, k, r })];
            checkFrames(frames);
            expect(frames[frames.length - 1]?.meta["nucleus"]).toEqual(bruteNucleus(k, r, sorted, adj));
        }
    });

    it("computes exact nucleus numbers for every vertex", () => {
        const graph = mod.defaultInput as { graph: Record<string, string[]>; r: number };
        const { labels, adj } = build(graph.graph);
        const r = graph.r;
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const numbers = frames[frames.length - 1]?.meta["nucleusNumbers"] as Record<string, number>;
        const full = new Set(labels);
        let maxK = 0;
        for (const v of labels) maxK = Math.max(maxK, countCliques(v, full, adj, r));
        for (const v of labels) {
            let expected = 0;
            for (let k = 1; k <= maxK; k += 1) {
                if (bruteNucleus(k, r, labels, adj).includes(v)) expected = k;
            }
            expect(numbers[v]).toBe(expected);
        }
    });

    it("treats k-core and k-truss as the first two members of the family", () => {
        const graph = { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"], D: ["A"] };
        const frames2 = [...mod.run({ graph, k: 2, r: 2 })];
        expect(frames2[frames2.length - 1]?.meta["nucleus"]).toEqual(["A", "B", "C"]);
        const frames3 = [...mod.run({ graph, k: 1, r: 3 })];
        expect(frames3[frames3.length - 1]?.meta["nucleus"]).toEqual(["A", "B", "C"]);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
