/** clique-percolation-method.test.ts - Brute-force community check, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import cliquePercolationMethod from "./clique-percolation-method";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? -1).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber ?? 999).toBeLessThan(cliquePercolationMethod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("graph");
        expect(frame.meta).toBeTypeOf("object");
        frame.edges.forEach((edge) => {
            const ids = new Set(frame.entities.map((entity) => entity.id));
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
    });
}

function sumAll(generator: Generator<VisualFrame, void, unknown>): VisualFrame[] {
    const frames: VisualFrame[] = [];
    for (const frame of generator) {
        frames.push(frame);
        expect(frames.length).toBeLessThan(100000);
    }
    return frames;
}

/** Brute force maximal cliques by enumerating every vertex subset. */
function bruteCommunities(nodes: string[], pairs: Array<[string, string]>, k: number): string[] {
    const edgeSet = new Set(pairs.map(([a, b]) => [a, b].sort().join("|")));
    const isClique = (subset: string[]): boolean => {
        for (let i = 0; i < subset.length; i += 1) {
            for (let j = i + 1; j < subset.length; j += 1) {
                if (!edgeSet.has([subset[i] as string, subset[j] as string].sort().join("|"))) {
                    return false;
                }
            }
        }
        return true;
    };
    const cliques: string[][] = [];
    for (let mask = 1; mask < 2 ** nodes.length; mask += 1) {
        const subset = nodes.filter((_, index) => (mask >> index) & 1);
        if (subset.length < k || !isClique(subset)) {
            continue;
        }
        const maximal = nodes.every(
            (node) =>
                subset.includes(node) || !isClique([...subset, node]),
        );
        if (maximal) {
            cliques.push([...subset].sort());
        }
    }
    const parent = cliques.map((_, index) => index);
    const find = (x: number): number => {
        let root = x;
        while (parent[root] !== root) {
            root = parent[root] as number;
        }
        return root;
    };
    for (let i = 0; i < cliques.length; i += 1) {
        for (let j = i + 1; j < cliques.length; j += 1) {
            const left = new Set(cliques[i]);
            const shared = (cliques[j] as string[]).filter((node) => left.has(node)).length;
            if (shared >= k - 1) {
                parent[find(j)] = find(i);
            }
        }
    }
    const groups = new Map<number, Set<string>>();
    cliques.forEach((clique, index) => {
        const group = groups.get(find(index)) ?? new Set<string>();
        for (const node of clique) {
            group.add(node);
        }
        groups.set(find(index), group);
    });
    return [...groups.values()]
        .map((group) => [...group].sort().join(","))
        .sort();
}

describe("Clique Percolation Method", () => {
    it("matches brute-force communities", () => {
        const graph = {
            nodes: ["A", "B", "C", "D", "E", "F", "G"],
            edges: [
                ["A", "B"],
                ["B", "C"],
                ["C", "A"],
                ["A", "D"],
                ["B", "D"],
                ["D", "E"],
                ["E", "F"],
                ["F", "D"],
            ] as Array<[string, string]>,
        };
        for (const k of [3, 2]) {
            const frames = sumAll(cliquePercolationMethod.run({ graph, k }));
            const final = frames[frames.length - 1];
            expect(final?.meta["communities"]).toEqual(bruteCommunities(graph.nodes, graph.edges, k));
        }
    });

    it("emits well-formed frames and terminates on the default input", () => {
        checkFrames(sumAll(cliquePercolationMethod.run(cliquePercolationMethod.defaultInput)));
        const generator = cliquePercolationMethod.run(cliquePercolationMethod.defaultInput);
        let count = 0;
        while (generator.next().done !== true) {
            count += 1;
            expect(count).toBeLessThan(100000);
        }
    });
});
