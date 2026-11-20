/**
 * tree-enumeration.test.ts - Independent Prufer decoder check, Cayley count,
 * frame shape, and termination for labeled tree enumeration.
 */

import { describe, expect, it } from "vitest";
import mod from "./tree-enumeration";

/** Independent decoder: physically remove the smallest leaf each step. */
function independentDecode(sequence: number[], n: number): Array<[number, number]> {
    const vertices = new Set(Array.from({ length: n }, (_, i) => i));
    const degree = new Array<number>(n).fill(1);
    for (const value of sequence) {
        degree[value] = (degree[value] as number) + 1;
    }
    const edges: Array<[number, number]> = [];
    const leafDegree = (v: number): number => {
        let count = 0;
        for (const [a, b] of edges) {
            if (a === v || b === v) {
                count += 1;
            }
        }
        return degree[v] - count;
    };
    for (const value of sequence) {
        let smallest = Infinity;
        for (const v of vertices) {
            if (leafDegree(v) === 1 && v < smallest) {
                smallest = v;
            }
        }
        const leaf = smallest;
        edges.push([Math.min(leaf, value), Math.max(leaf, value)]);
        vertices.delete(leaf);
    }
    const remaining = [...vertices].sort((a, b) => a - b);
    if (remaining.length >= 2) {
        edges.push([remaining[0] as number, remaining[1] as number]);
    }
    return edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function edgeKey(edges: Array<[number, number]>): string {
    return edges.map(([a, b]) => `${a}-${b}`).join("|");
}

function isTree(edges: Array<[number, number]>, n: number): boolean {
    if (edges.length !== Math.max(0, n - 1)) {
        return false;
    }
    if (n === 0) {
        return true;
    }
    const adjacency = new Map<number, number[]>();
    for (let i = 0; i < n; i += 1) {
        adjacency.set(i, []);
    }
    for (const [a, b] of edges) {
        adjacency.get(a)?.push(b);
        adjacency.get(b)?.push(a);
    }
    const seen = new Set<number>([0]);
    const queue = [0];
    while (queue.length > 0) {
        const current = queue.shift() as number;
        for (const neighbor of adjacency.get(current) ?? []) {
            if (!seen.has(neighbor)) {
                seen.add(neighbor);
                queue.push(neighbor);
            }
        }
    }
    return seen.size === n;
}

describe("Tree Enumeration", () => {
    it("reports Cayley's count and distinct trees for small n", () => {
        for (const n of [1, 2, 3, 4]) {
            const frames = [...mod.run({ n })];
            const last = frames[frames.length - 1];
            const expected = n === 1 ? 1 : n ** (n - 2);
            expect(last?.meta.total, `n=${n}`).toBe(expected);
            expect(last?.meta.cayley, `n=${n}`).toBe(expected);
            expect(last?.meta.distinct, `n=${n}`).toBe(expected);
            expect(last?.meta.complete, `n=${n}`).toBe(true);
        }
    });

    it("matches an independent Prufer decoder for every shown tree", () => {
        for (const n of [2, 3, 4]) {
            const frames = [...mod.run({ n })];
            const shownFrames = frames.filter((frame) => Array.isArray(frame.meta.sequence));
            expect(shownFrames.length).toBeGreaterThan(0);
            for (const frame of shownFrames) {
                const sequence = frame.meta.sequence as number[];
                const expected = independentDecode(sequence, n);
                expect(isTree(expected, n)).toBe(true);
                const undirected = frame.edges.map((edge) => {
                    const a = Number((edge.sourceId as string).slice(5));
                    const b = Number((edge.targetId as string).slice(5));
                    return [Math.min(a, b), Math.max(a, b)] as [number, number];
                }).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
                expect(edgeKey(undirected), `n=${n} sequence ${sequence}`).toBe(edgeKey(expected));
            }
        }
    });

    it("independent enumeration produces all distinct labeled trees", () => {
        for (const n of [3, 4, 5]) {
            const length = n - 2;
            const total = n ** length;
            const signatures = new Set<string>();
            for (let code = 0; code < total; code += 1) {
                const sequence = new Array<number>(length).fill(0);
                let value = code;
                for (let i = length - 1; i >= 0; i -= 1) {
                    sequence[i] = value % n;
                    value = Math.floor(value / n);
                }
                const edges = independentDecode(sequence, n);
                expect(isTree(edges, n), `n=${n} code=${code}`).toBe(true);
                signatures.add(edgeKey(edges));
            }
            expect(signatures.size, `n=${n}`).toBe(total);
        }
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(typeof frame.description).toBe("string");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber as number).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber as number).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("tree");
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.size).toBe(frame.entities.length);
            for (const e of frame.entities) {
                expect(typeof e.metadata.parentId).toBe("string");
                expect(Number.isFinite(e.x)).toBe(true);
                expect(Number.isFinite(e.y)).toBe(true);
            }
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });
});
