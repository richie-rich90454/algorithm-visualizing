/**
 * clique-cover.test.ts - Exhaustive minimum cover check, clique property,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./clique-cover";
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

/** Exhaustive coloring of the complement with canonical color introduction. */
function bruteForceCliqueCover(adjacency: Adj): number {
    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])].sort();
    const n = labels.length;
    const key = (a: string, b: string): string => [a, b].sort().join("|");
    const original = new Set<string>();
    for (const a of labels) {
        for (const b of adjacency[a] ?? []) {
            if (a !== String(b)) {
                original.add(key(a, String(b)));
            }
        }
    }
    const complement = labels.map((a, i) =>
        labels.filter((b, j) => i !== j && !original.has(key(a, b))),
    );
    const colors = Array<number>(n).fill(-1);
    let best = n + 1;
    const dfs = (i: number, used: number): void => {
        if (used >= best) {
            return;
        }
        if (i === n) {
            best = used;
            return;
        }
        for (let c = 0; c <= used; c += 1) {
            let conflict = false;
            for (let p = 0; p < i; p += 1) {
                if (colors[p] === c && complement[i]?.includes(labels[p] as string)) {
                    conflict = true;
                    break;
                }
            }
            if (conflict) {
                continue;
            }
            colors[i] = c;
            dfs(i + 1, Math.max(used, c + 1));
            colors[i] = -1;
        }
    };
    dfs(0, 0);
    return best;
}

describe("Minimum Clique Cover", () => {
    it("matches exhaustive search on several small graphs", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { graph: Adj }).graph,
            { A: ["B"], B: ["A", "C"], C: ["B"] },
            { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
            { A: ["B", "C"], B: ["A"], C: ["A"], D: [] },
        ];
        for (const graph of graphs) {
            const frames = [...mod.run({ graph })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["cliqueCount"]).toBe(bruteForceCliqueCover(graph));
        }
    });

    it("returns groups that are cliques and partition the vertices", () => {
        const graph = (mod.defaultInput as { graph: Adj }).graph;
        const frames = [...mod.run({ graph })];
        const cliques = frames[frames.length - 1]?.meta["cliques"] as string[];
        const key = (a: string, b: string): string => [a, b].sort().join("|");
        const edges = new Set<string>();
        for (const a of Object.keys(graph)) {
            for (const b of graph[a] ?? []) {
                edges.add(key(a, String(b)));
            }
        }
        const seen: string[] = [];
        for (const group of cliques) {
            const members = group.split("+");
            seen.push(...members);
            for (let i = 0; i < members.length; i += 1) {
                for (let j = i + 1; j < members.length; j += 1) {
                    expect(edges.has(key(members[i] as string, members[j] as string))).toBe(true);
                }
            }
        }
        expect(seen.sort()).toEqual(Object.keys(graph).sort());
        expect(cliques.length).toBe(Number(frames[frames.length - 1]?.meta["cliqueCount"]));
    });

    it("handles an empty graph and terminates", () => {
        const empty = [...mod.run({ graph: {} })];
        checkFrames(empty);
        expect(empty[empty.length - 1]?.meta["cliqueCount"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
