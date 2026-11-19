import { describe, expect, it } from "vitest";
import coloring from "./graph-coloring-precoloring-extension";

const VALID = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

describe("PrecoloringExtension", () => {
    it("yields well-formed graph frames and terminates", () => {
        let index = 0;
        for (const frame of coloring.run(coloring.defaultInput)) {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(coloring.pseudocode!.length);
            expect(frame.layout).toBe("graph");
            const ids = new Set(frame.entities.map((e) => e.id));
            for (const entity of frame.entities) {
                expect(entity.type).toBe("node");
                expect(VALID.has(entity.state)).toBe(true);
            }
            for (const edge of frame.edges) {
                expect(ids.has(edge.sourceId)).toBe(true);
                expect(ids.has(edge.targetId)).toBe(true);
            }
            index += 1;
        }
        expect(index).toBeGreaterThan(0);
    });

    it("extends random precolorings into proper colorings", () => {
        let seed = 131;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 20; trial += 1) {
            const n = 5;
            const vertices = Array.from({ length: n }, (_, i) => i);
            const k = 3;
            const truth = vertices.map(() => rand() % k);
            const edges: Array<[number, number]> = [];
            for (let u = 0; u < n; u += 1) {
                for (let v = u + 1; v < n; v += 1) {
                    if (truth[u] !== truth[v] && rand() % 2 === 0) edges.push([u, v]);
                }
            }
            const precolored: Record<string, number> = {};
            for (const v of vertices) {
                if (rand() % 3 === 0) precolored[v] = truth[v]!;
            }
            let last = null;
            for (const frame of coloring.run({ vertices, edges, k, precolored })) last = frame;
            expect(last).not.toBeNull();
            expect(last!.meta.solved).toBe(true);

            const assigned = new Map<number, number>();
            for (const entity of last!.entities) {
                const match = /^(\d+):c(\d+)$/.exec(entity.label);
                expect(match).not.toBeNull();
                assigned.set(Number(match![1]), Number(match![2]));
            }
            for (const v of vertices) {
                if (precolored[v] !== undefined) expect(assigned.get(v)).toBe(precolored[v]);
            }
            for (const [u, v] of edges) {
                expect(assigned.get(u)).not.toBe(assigned.get(v));
            }
        }
    });
});
