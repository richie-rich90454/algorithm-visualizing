import { describe, expect, it } from "vitest";
import leiden from "./leiden-community";

const VALID = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

describe("LeidenCommunity", () => {
    it("yields well-formed graph frames and terminates", () => {
        let index = 0;
        for (const frame of leiden.run(leiden.defaultInput)) {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(leiden.pseudocode!.length);
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
            expect(typeof frame.meta.modularity).toBe("number");
            index += 1;
        }
        expect(index).toBeGreaterThan(0);
    });

    it("produces connected communities with non-decreasing modularity", () => {
        let seed = 149;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 20; trial += 1) {
            const n = 6;
            const vertices = Array.from({ length: n }, (_, i) => i);
            const edges: Array<[number, number]> = [];
            for (let u = 0; u < n; u += 1) {
                for (let v = u + 1; v < n; v += 1) {
                    if (rand() % 3 === 0) edges.push([u, v]);
                }
            }
            const frames = [];
            let previous = -Infinity;
            for (const frame of leiden.run({ vertices, edges })) {
                const q = frame.meta.modularity as number;
                expect(q).toBeGreaterThanOrEqual(previous - 1e-9);
                previous = q;
                frames.push(frame);
            }
            const last = frames[frames.length - 1]!;
            const communityOf = new Map<number, number>();
            for (const entity of last.entities) {
                communityOf.set(Number(entity.metadata.vertex), Number(entity.metadata.community));
            }
            expect(communityOf.size).toBe(n);

            const adjacency = new Map<number, number[]>();
            for (const v of vertices) adjacency.set(v, []);
            for (const [u, v] of edges) {
                adjacency.get(u)!.push(v);
                adjacency.get(v)!.push(u);
            }
            const groups = new Map<number, number[]>();
            for (const [v, c] of communityOf) {
                const list = groups.get(c) ?? [];
                list.push(v);
                groups.set(c, list);
            }
            for (const members of groups.values()) {
                const memberSet = new Set(members);
                const seen = new Set<number>([members[0]!]);
                const stack = [members[0]!];
                while (stack.length) {
                    const u = stack.pop()!;
                    for (const neighbor of adjacency.get(u) ?? []) {
                        if (memberSet.has(neighbor) && !seen.has(neighbor)) {
                            seen.add(neighbor);
                            stack.push(neighbor);
                        }
                    }
                }
                expect(seen.size).toBe(members.length);
            }
        }
    });
});
