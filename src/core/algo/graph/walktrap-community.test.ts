/** Correctness, frame shape, and termination checks for Walktrap. */
import { describe, expect, it } from "vitest";
import mod from "./walktrap-community";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
    });
}

function canonical(groups: string[][]): string {
    return groups.map((g) => [...g].sort().join(",")).sort().join("|");
}

/** Independent re-implementation of the profile-merge rule. */
function reference(edges: Array<[string, string, number?]>, target: number): string[][] {
    const vertices = [...new Set(edges.flatMap(([a, b]) => [a, b]))].sort();
    const n = vertices.length;
    const idx = new Map(vertices.map((v, i) => [v, i]));
    const w = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (const [a, b, rawWeight] of edges) {
        const u = idx.get(a);
        const v = idx.get(b);
        if (u === undefined || v === undefined || u === v) continue;
        const weight = typeof rawWeight === "number" && rawWeight > 0 ? rawWeight : 1;
        w[u]![v] = (w[u]![v] ?? 0) + weight;
        w[v]![u] = (w[v]![u] ?? 0) + weight;
    }
    const transition = w.map((row) => {
        const total = row.reduce((s, x) => s + x, 0);
        return total > 0 ? row.map((x) => x / total) : row.map(() => 0);
    });
    let communities: number[][] = vertices.map((_, i) => [i]);
    const prof = (community: number[]): number[] => {
        const p = new Array<number>(n).fill(0);
        for (const u of community) for (let v = 0; v < n; v += 1) p[v] = (p[v] ?? 0) + (transition[u]?.[v] ?? 0) / community.length;
        return p;
    };
    const dist = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + (x - (b[i] ?? 0)) ** 2, 0);
    while (communities.length > target) {
        const profiles = communities.map(prof);
        let bi = -1;
        let bj = -1;
        let best = Infinity;
        for (let i = 0; i < communities.length; i += 1) {
            for (let j = i + 1; j < communities.length; j += 1) {
                const d = dist(profiles[i] ?? [], profiles[j] ?? []);
                if (d < best) { best = d; bi = i; bj = j; }
            }
        }
        if (bi < 0) break;
        const merged = [...(communities[bi] ?? []), ...(communities[bj] ?? [])].sort((a, b) => a - b);
        communities = communities.filter((_, k) => k !== bi && k !== bj);
        communities.push(merged);
        communities = communities.slice().sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0));
    }
    return communities.map((c) => c.map((i) => vertices[i] as string));
}

describe("Walktrap Community Detection", () => {
    const cases: Array<{ edges: Array<[string, string, number?]>; target: number }> = [
        { edges: [["A", "B", 1], ["B", "C", 1], ["C", "A", 1], ["C", "D", 1], ["D", "E", 1], ["E", "F", 1], ["F", "D", 1]], target: 2 },
        { edges: [["A", "B", 2], ["A", "C", 1], ["B", "C", 3], ["C", "D", 1], ["D", "E", 2]], target: 1 },
        { edges: [["A", "B", 1], ["B", "C", 1], ["C", "D", 1]], target: 2 },
    ];

    for (const input of cases) {
        it(`matches the independent profile-merge reference for ${JSON.stringify(input.edges.length)} edges`, () => {
            const frames = [...mod.run({ edges: input.edges, targetCommunities: input.target })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const groups = (final?.["communities"] as string[]).map((s) => s.split(","));
            expect(groups.length).toBe(input.target);
            const covered = groups.flat();
            expect(covered.length).toBe(new Set(covered).size);
            expect(new Set(covered).size).toBe(new Set(input.edges.flatMap(([a, b]) => [a, b])).size);
            expect(canonical(groups)).toBe(canonical(reference(input.edges, input.target)));
        });
    }

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
