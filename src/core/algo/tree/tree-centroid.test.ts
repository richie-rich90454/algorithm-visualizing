import { describe, expect, it } from "vitest";
import mod from "./tree-centroid";

type Tree = { parentMap: Record<string, string | null>; ids: string[] };

/** Independent brute force: remove every vertex and walk each remaining branch. */
function bruteForce(tree: Tree): { centroids: string[]; largest: Map<string, number> } {
    const adjacency = new Map<string, string[]>();
    for (const id of tree.ids) {
        adjacency.set(id, []);
    }
    for (const [child, parent] of Object.entries(tree.parentMap)) {
        if (parent && tree.ids.includes(child) && tree.ids.includes(parent)) {
            adjacency.get(child)?.push(parent);
            adjacency.get(parent)?.push(child);
        }
    }
    const largest = new Map<string, number>();
    for (const v of tree.ids) {
        let worst = 0;
        for (const start of adjacency.get(v) ?? []) {
            const seen = new Set<string>([start]);
            const queue = [start];
            while (queue.length > 0) {
                const u = queue.shift() as string;
                for (const w of adjacency.get(u) ?? []) {
                    if (w !== v && !seen.has(w)) {
                        seen.add(w);
                        queue.push(w);
                    }
                }
            }
            worst = Math.max(worst, seen.size);
        }
        largest.set(v, worst);
    }
    const limit = tree.ids.length / 2;
    return {
        centroids: tree.ids.filter((v) => (largest.get(v) ?? Infinity) <= limit),
        largest,
    };
}

function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function randomTree(n: number, random: () => number): Tree {
    const ids = Array.from({ length: n }, (_, i) => `V${i}`);
    const parentMap: Record<string, string | null> = {};
    for (let i = 1; i < n; i += 1) {
        parentMap[ids[i] as string] = ids[Math.floor(random() * i)] as string;
    }
    return { parentMap, ids };
}

describe("Tree Centroid", () => {
    it("finds the same centroid set as brute force on the default tree", () => {
        const input = mod.defaultInput as Tree;
        const expected = bruteForce(input);
        const frames = [...mod.run(input)];
        const last = frames[frames.length - 1];
        expect(last?.meta.centroids).toEqual(expected.centroids);
        const sorted = (last?.entities ?? []).filter((e) => e.state === "sorted").map((e) => e.id);
        expect(sorted.sort()).toEqual(expected.centroids.map((c) => `node-${c}`).sort());
    });

    it("reports exact component sizes for every candidate vertex", () => {
        const input = mod.defaultInput as Tree;
        const expected = bruteForce(input);
        const frames = [...mod.run(input)];
        const candidateFrames = frames.filter((f) => typeof f.meta.vertex === "string");
        expect(candidateFrames.length).toBe(input.ids.length);
        for (const frame of candidateFrames) {
            const v = frame.meta.vertex as string;
            expect(frame.meta.maxComponent).toBe(expected.largest.get(v));
            expect(frame.meta.limit).toBe(input.ids.length / 2);
            const hot = frame.entities.filter((e) => e.state === "comparing");
            expect(hot).toHaveLength(1);
            expect(hot[0]?.id).toBe(`node-${v}`);
        }
    });

    it("agrees with brute force on random trees and respects the one-or-two rule", () => {
        const random = seeded(712367);
        for (let trial = 0; trial < 60; trial += 1) {
            const tree = randomTree(1 + Math.floor(random() * 9), random);
            const expected = bruteForce(tree);
            const frames = [...mod.run(tree)];
            const last = frames[frames.length - 1];
            expect(last?.meta.centroids, `trial ${trial} tree ${JSON.stringify(tree)}`).toEqual(expected.centroids);
            expect(expected.centroids.length === 1 || expected.centroids.length === 2).toBe(true);
            if (expected.centroids.length === 2) {
                const [a, b] = expected.centroids as [string, string];
                const children = Object.entries(tree.parentMap).filter(([c, p]) => p === a && c === b);
                const reverse = Object.entries(tree.parentMap).filter(([c, p]) => p === b && c === a);
                expect(children.length + reverse.length).toBe(1);
            }
            for (const c of expected.centroids) {
                expect(expected.largest.get(c) as number).toBeLessThanOrEqual(tree.ids.length / 2);
            }
            for (const v of tree.ids) {
                if (!expected.centroids.includes(v)) {
                    expect(expected.largest.get(v) as number).toBeGreaterThan(tree.ids.length / 2);
                }
            }
        }
    });

    it("every frame is well formed and the generator terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBe((mod.defaultInput as Tree).ids.length + 2);
        frames.forEach((frame, i) => {
            expect(frame.stepNumber).toBe(i);
            expect(typeof frame.description).toBe("string");
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(Number.isInteger(frame.codeLineNumber)).toBe(true);
            expect(frame.codeLineNumber as number).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber as number).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(frame.layout).toBe("tree");
            expect(typeof frame.meta.vertices).toBe("number");
            expect(typeof frame.meta.limit).toBe("number");
            const ids = new Set(frame.entities.map((e) => e.id));
            expect(ids.size).toBe(frame.entities.length);
            for (const e of frame.entities) {
                expect(typeof e.metadata.parentId).toBe("string");
                expect(Number.isFinite(e.x)).toBe(true);
                expect(Number.isFinite(e.y)).toBe(true);
                expect(Number.isFinite(e.width)).toBe(true);
                expect(Number.isFinite(e.height)).toBe(true);
            }
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
        });
    });

    it("handles empty input and a single-node tree", () => {
        const empty = [...mod.run({ parentMap: {}, ids: [] })];
        expect(empty).toHaveLength(1);
        expect(empty[0]?.entities.length).toBe(0);
        expect(empty[0]?.description.length).toBeGreaterThanOrEqual(10);

        const single = [...mod.run({ parentMap: {}, ids: ["A"] })];
        expect(single[single.length - 1]?.meta.centroids).toEqual(["A"]);
    });
});
