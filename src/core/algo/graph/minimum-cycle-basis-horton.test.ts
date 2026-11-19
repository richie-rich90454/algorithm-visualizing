import { describe, expect, it } from "vitest";
import horton from "./minimum-cycle-basis-horton";

const VALID = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

function enumerateCycles(n: number, edges: Array<[number, number]>): bigint[] {
    const adjacency: number[][] = Array.from({ length: n }, () => []);
    edges.forEach(([a, b], e) => {
        adjacency[a]!.push(e);
        adjacency[b]!.push(e);
    });
    const other = (e: number, u: number): number => (edges[e]![0] === u ? edges[e]![1]! : edges[e]![0]!);
    const found = new Map<string, bigint>();
    for (let start = 0; start < n; start += 1) {
        const seen = new Set<number>([start]);
        const path: number[] = [];
        const visit = (u: number): void => {
            for (const e of adjacency[u] ?? []) {
                const v = other(e, u);
                if (v === start && path.length >= 2) {
                    let mask = 0n;
                    for (const pe of path) mask |= 1n << BigInt(pe);
                    mask |= 1n << BigInt(e);
                    found.set(mask.toString(), mask);
                } else if (v > start && !seen.has(v)) {
                    seen.add(v);
                    path.push(e);
                    visit(v);
                    path.pop();
                    seen.delete(v);
                }
            }
        };
        visit(start);
    }
    return [...found.values()];
}

function canAdd(basis: Map<number, bigint>, mask: bigint): boolean {
    let x = mask;
    while (x !== 0n) {
        const bit = x.toString(2).length - 1;
        const existing = basis.get(bit);
        if (existing !== undefined) {
            x ^= existing;
        } else {
            basis.set(bit, x);
            return true;
        }
    }
    return false;
}

function cycleDimension(n: number, edges: Array<[number, number]>): number {
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => {
        while (parent[x] !== x) x = parent[x] as number;
        return x;
    };
    for (const [a, b] of edges) {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent[ra] = rb;
    }
    const components = new Set(Array.from({ length: n }, (_, i) => find(i))).size;
    return edges.length - n + components;
}

function bruteForceMinimumBasisWeight(cycles: bigint[], dimension: number): number {
    if (dimension === 0) return 0;
    let best = Infinity;
    const weight = (mask: bigint): number => mask.toString(2).split("1").length - 1;
    const choose = (start: number, chosen: bigint[]): void => {
        if (chosen.length === dimension) {
            const basis = new Map<number, bigint>();
            for (const mask of chosen) {
                if (!canAdd(basis, mask)) return;
            }
            best = Math.min(best, chosen.reduce((sum, mask) => sum + weight(mask), 0));
            return;
        }
        for (let i = start; i < cycles.length; i += 1) {
            chosen.push(cycles[i]!);
            choose(i + 1, chosen);
            chosen.pop();
        }
    };
    choose(0, []);
    return best;
}

describe("HortonMinimumCycleBasis", () => {
    it("yields well-formed graph frames and terminates", () => {
        let index = 0;
        for (const frame of horton.run(horton.defaultInput)) {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(horton.pseudocode!.length);
            expect(frame.layout).toBe("graph");
            const ids = new Set(frame.entities.map((e) => e.id));
            for (const entity of frame.entities) {
                expect(entity.type).toBe("node");
                expect(VALID.has(entity.state)).toBe(true);
            }
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
                expect(VALID.has(edge.state)).toBe(true);
            }
            index += 1;
        }
        expect(index).toBeGreaterThan(0);
    });

    it("matches a brute-force minimum basis on small graphs", () => {
        let seed = 163;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        let checked = 0;
        for (let trial = 0; trial < 60 && checked < 15; trial += 1) {
            const n = 4 + (rand() % 2);
            const vertices = Array.from({ length: n }, (_, i) => i);
            const edges: Array<[number, number]> = [];
            for (let u = 0; u < n; u += 1) {
                for (let v = u + 1; v < n; v += 1) {
                    if (rand() % 2 === 0) edges.push([u, v]);
                }
            }
            const cycles = enumerateCycles(n, edges);
            if (cycles.length === 0 || cycles.length > 16) continue;
            const dimension = cycleDimension(n, edges);
            const expected = bruteForceMinimumBasisWeight(cycles, dimension);
            if (!Number.isFinite(expected)) continue;

            let last = null;
            for (const frame of horton.run({ vertices, edges })) last = frame;
            expect(last).not.toBeNull();
            expect(last!.meta.basisSize).toBe(dimension);
            expect(last!.meta.totalWeight).toBe(expected);
            checked += 1;
        }
        expect(checked).toBeGreaterThan(0);
    });
});
