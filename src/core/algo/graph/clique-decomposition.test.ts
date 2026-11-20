/**
 * clique-decomposition.test.ts - Exhaustive minimum edge clique cover check,
 * cover validity, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./clique-decomposition";
import type { VisualFrame } from "@/types";

type Adj = Record<string, string[]>;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
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

/** Enumerate all cliques by subset, then solve exact edge cover by DP over masks. */
function bruteEdgeCliqueCover(raw: Adj): number {
    const labels = [...new Set([...Object.keys(raw), ...Object.values(raw).flat().map(String)])].sort();
    const n = labels.length;
    const idx = new Map(labels.map((label, i) => [label, i] as [string, number]));
    const adj = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
    for (const a of labels) {
        for (const b of raw[a] ?? []) {
            const ai = idx.get(a);
            const bi = idx.get(String(b));
            if (ai !== undefined && bi !== undefined && ai !== bi) {
                adj[ai]![bi] = true;
                adj[bi]![ai] = true;
            }
        }
    }
    const edges: Array<[number, number]> = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            if (adj[i]![j]) edges.push([i, j]);
        }
    }
    const m = edges.length;
    if (m === 0) return 0;
    const edgePos = new Map(edges.map((edge, i) => [edge.join("|"), i] as [string, number]));
    const cliqueMasks: number[] = [];
    for (let mask = 1; mask < 1 << n; mask += 1) {
        const members: number[] = [];
        for (let i = 0; i < n; i += 1) if (mask & (1 << i)) members.push(i);
        let complete = true;
        for (let a = 0; a < members.length && complete; a += 1) {
            for (let b = a + 1; b < members.length; b += 1) {
                if (!adj[members[a]!]![members[b]!]) {
                    complete = false;
                    break;
                }
            }
        }
        if (!complete) continue;
        let edgeMask = 0;
        for (let a = 0; a < members.length; a += 1) {
            for (let b = a + 1; b < members.length; b += 1) {
                const pos = edgePos.get(`${members[a]}|${members[b]}`);
                if (pos !== undefined) edgeMask |= 1 << pos;
            }
        }
        if (edgeMask !== 0) cliqueMasks.push(edgeMask);
    }
    const full = (1 << m) - 1;
    const dp = Array<number>(full + 1).fill(Infinity);
    dp[0] = 0;
    for (let covered = 0; covered <= full; covered += 1) {
        if (!Number.isFinite(dp[covered]!)) continue;
        for (const cm of cliqueMasks) {
            const next = covered | cm;
            if (dp[next]! > dp[covered]! + 1) dp[next] = dp[covered]! + 1;
        }
    }
    return dp[full]!;
}

describe("Minimum Edge Clique Decomposition", () => {
    const graphs: Adj[] = [
        (mod.defaultInput as { graph: Adj }).graph,
        { A: ["B", "D"], B: ["A", "C"], C: ["B", "D"], D: ["A", "C"] },
        { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
        { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["A", "B", "C"] },
        { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
    ];

    it("matches exhaustive minimum cover on small graphs", () => {
        for (const graph of graphs) {
            const frames = [...mod.run({ graph })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!;
            expect(final.meta["finalized"]).toBe(true);
            expect(final.meta["coverSize"]).toBe(bruteEdgeCliqueCover(graph));
        }
    });

    it("returns cliques that are complete and cover every edge", () => {
        const graph = graphs[0]!;
        const frames = [...mod.run({ graph })];
        const cover = frames[frames.length - 1]!.meta["cover"] as string[];
        const labels = Object.keys(graph);
        const adj = new Set<string>();
        for (const a of labels) for (const b of graph[a] ?? []) adj.add([a, String(b)].sort().join("|"));
        const covered = new Set<string>();
        for (const group of cover) {
            const members = group.split("+");
            for (let i = 0; i < members.length; i += 1) {
                for (let j = i + 1; j < members.length; j += 1) {
                    const key = [members[i], members[j]].sort().join("|");
                    expect(adj.has(key)).toBe(true);
                    covered.add(key);
                }
            }
        }
        expect([...covered].sort()).toEqual([...adj].sort());
        expect(cover.length).toBe(Number(frames[frames.length - 1]!.meta["coverSize"]));
    });

    it("handles an edgeless graph and terminates", () => {
        const empty = [...mod.run({ graph: { A: [], B: [] } })];
        checkFrames(empty);
        expect(empty[empty.length - 1]!.meta["coverSize"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
