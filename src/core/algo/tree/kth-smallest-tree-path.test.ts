/**
 * kth-smallest-tree-path.test.ts - Brute-force path check, frame shape, and
 * termination for k-th smallest value on a tree path.
 */

import { describe, expect, it } from "vitest";
import mod from "./kth-smallest-tree-path";

interface Query {
    u: string;
    v: string;
    k: number;
}
interface TreeInput {
    parentMap: Record<string, string | null>;
    ids: string[];
    values: Record<string, number>;
    queries: Query[];
}

/** Independent brute force: walk the unique path and sort its values. */
function bruteAnswer(input: TreeInput, query: Query): number {
    const adjacency = new Map<string, string[]>();
    for (const id of input.ids) {
        adjacency.set(id, []);
    }
    for (const [child, parent] of Object.entries(input.parentMap)) {
        if (parent && adjacency.has(child) && adjacency.has(parent)) {
            adjacency.get(child)?.push(parent);
            adjacency.get(parent)?.push(child);
        }
    }
    const parent = new Map<string, string | null>([[query.u, null]]);
    const queue = [query.u];
    while (queue.length > 0) {
        const current = queue.shift() as string;
        if (current === query.v) {
            break;
        }
        for (const neighbor of adjacency.get(current) ?? []) {
            if (!parent.has(neighbor)) {
                parent.set(neighbor, current);
                queue.push(neighbor);
            }
        }
    }
    const values: number[] = [];
    let cursor: string | null = query.v;
    while (cursor !== null) {
        values.push(input.values[cursor] ?? 0);
        cursor = parent.get(cursor) ?? null;
    }
    values.sort((a, b) => a - b);
    return query.k >= 1 && query.k <= values.length ? (values[query.k - 1] as number) : -1;
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function randomTree(n: number, random: () => number): TreeInput {
    const ids = Array.from({ length: n }, (_, i) => `V${i}`);
    const parentMap: Record<string, string | null> = {};
    const values: Record<string, number> = {};
    for (let i = 0; i < n; i += 1) {
        values[ids[i] as string] = Math.floor(random() * 9);
        if (i > 0) {
            parentMap[ids[i] as string] = ids[Math.floor(random() * i)] as string;
        }
    }
    const queries: Query[] = [];
    for (let i = 0; i < 5; i += 1) {
        queries.push({
            u: ids[Math.floor(random() * n)] as string,
            v: ids[Math.floor(random() * n)] as string,
            k: 1 + Math.floor(random() * n),
        });
    }
    return { parentMap, ids, values, queries };
}

describe("k-th Smallest on Tree Path", () => {
    it("matches brute force on the default queries", () => {
        const input = mod.defaultInput as TreeInput;
        const frames = [...mod.run(input)];
        const last = frames[frames.length - 1];
        const results = last?.meta.results as string[];
        expect(results).toHaveLength(input.queries.length);
        input.queries.forEach((query, index) => {
            const expected = bruteAnswer(input, query);
            expect(results[index], `query ${index}`).toBe(`${query.u}-${query.v}:k${query.k}=${expected}`);
        });
    });

    it("agrees with brute force on random trees and queries", () => {
        const random = seeded(123987);
        for (let trial = 0; trial < 70; trial += 1) {
            const input = randomTree(1 + Math.floor(random() * 11), random);
            const last = [...mod.run(input)].pop();
            const results = last?.meta.results as string[];
            expect(results.length, `trial ${trial}`).toBe(input.queries.length);
            input.queries.forEach((query, index) => {
                const expected = bruteAnswer(input, query);
                expect(results[index], `trial ${trial} query ${index}`).toBe(
                    `${query.u}-${query.v}:k${query.k}=${expected}`,
                );
            });
        }
    });

    it("handles an out-of-range k and a single-node tree", () => {
        const input = mod.defaultInput as TreeInput;
        const outOfRange = [...mod.run({ ...input, queries: [{ u: "D", v: "G", k: 99 }] })];
        expect((outOfRange[outOfRange.length - 1]?.meta.results as string[])[0]).toBe("D-G:k99=-1");
        const single = [...mod.run({ parentMap: {}, ids: ["A"], values: { A: 5 }, queries: [{ u: "A", v: "A", k: 1 }] })];
        expect((single[single.length - 1]?.meta.results as string[])[0]).toBe("A-A:k1=5");
    });

    it("every frame is well formed and the generator terminates", () => {
        const input = mod.defaultInput as TreeInput;
        const frames = [...mod.run(input)];
        expect(frames).toHaveLength(input.queries.length + 2);
        frames.forEach((frame, index) => {
            expect(frame.stepNumber).toBe(index);
            expect(typeof frame.description).toBe("string");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber as number).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber as number).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("tree");
            expect(Array.isArray(frame.meta.results)).toBe(true);
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
