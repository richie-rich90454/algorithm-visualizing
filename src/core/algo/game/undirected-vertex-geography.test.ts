import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./undirected-vertex-geography";

type Edge = [number, number];

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(f.codeLineNumber ?? 0).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(f.layout).toBe("graph");
        expect(f.entities.length).toBeGreaterThan(0);
        const ids = new Set(f.entities.map((e) => e.id));
        for (const edge of f.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
            expect(edge.directed).toBe(false);
        }
        expect(f.meta).toBeDefined();
        f.entities.forEach((e) => expect(Number.isFinite(e.x)).toBe(true));
    });
}

// Independent brute-force game-tree winner: does the player to move win?
function bruteWinner(vertices: number[], edges: Edge[], start: number): "first" | "second" {
    const adj = new Map<number, number[]>();
    for (const v of vertices) adj.set(v, []);
    for (const [a, b] of edges) {
        adj.get(a)?.push(b);
        adj.get(b)?.push(a);
    }
    const win = (v: number, seen: Set<number>): boolean => {
        for (const next of adj.get(v) ?? []) {
            if (seen.has(next)) continue;
            const s2 = new Set(seen);
            s2.add(next);
            if (!win(next, s2)) return true;
        }
        return false;
    };
    return win(start, new Set([start])) ? "first" : "second";
}

describe("UndirectedVertexGeography", () => {
    const cases = [
        { vertices: [0, 1, 2, 3, 4, 5], edges: [[0, 1], [0, 2], [1, 3], [2, 3], [2, 4], [3, 5], [4, 5]] as Edge[], start: 0 },
        { vertices: [0, 1, 2], edges: [[0, 1], [1, 2]] as Edge[], start: 1 },
        { vertices: [0, 1, 2, 3], edges: [[0, 1], [1, 2], [2, 3], [3, 0]] as Edge[], start: 0 },
        { vertices: [0, 1, 2, 3, 4], edges: [[0, 1], [0, 2], [0, 3], [0, 4]] as Edge[], start: 0 },
    ];

    it("agrees with an exhaustive game-tree search on the winner", () => {
        for (const input of cases) {
            const fs = frames(input);
            shapes(fs);
            const last = fs[fs.length - 1];
            expect(last?.meta.winner).toBe(bruteWinner(input.vertices, input.edges, input.start));
            expect(Number(last?.meta.maxMatching)).toBeGreaterThanOrEqual(Number(last?.meta.maxWithoutStart));
            const moves = last?.meta.moves as number[];
            expect(moves[0]).toBe(input.start);
            expect(new Set(moves).size).toBe(moves.length);
        }
    });

    it("ends on a stuck vertex and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const moves = fs[fs.length - 1]?.meta.moves as number[];
        expect(moves.length).toBeGreaterThan(1);
        expect(fs[fs.length - 1]?.stepNumber).toBe(fs.length - 1);
    });
});
