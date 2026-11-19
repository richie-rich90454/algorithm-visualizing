import { describe, expect, it } from "vitest";
import bridgesOnline from "./bridges-online";

const VALID = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

function referenceBridges(nodeIds: string[], edges: Array<{ id: string; a: string; b: string }>): Set<string> {
    const reachable = (skip: string, from: string, to: string): boolean => {
        const adjacency = new Map<string, string[]>();
        for (const id of nodeIds) adjacency.set(id, []);
        for (const edge of edges) {
            if (edge.id === skip) continue;
            adjacency.get(edge.a)?.push(edge.b);
            adjacency.get(edge.b)?.push(edge.a);
        }
        const seen = new Set<string>([from]);
        const stack = [from];
        while (stack.length) {
            const u = stack.pop() as string;
            for (const v of adjacency.get(u) ?? []) {
                if (v === to) return true;
                if (!seen.has(v)) {
                    seen.add(v);
                    stack.push(v);
                }
            }
        }
        return false;
    };
    const result = new Set<string>();
    for (const edge of edges) {
        if (!reachable(edge.id, edge.a, edge.b)) result.add(edge.id);
    }
    return result;
}

describe("OnlineBridgeFinding", () => {
    it("yields well-formed graph frames and terminates", () => {
        let index = 0;
        for (const frame of bridgesOnline.run(bridgesOnline.defaultInput)) {
            expect(frame.stepNumber).toBe(index);
            expect(frame.entities.length).toBeGreaterThan(0);
            expect(frame.description.length).toBeGreaterThanOrEqual(10);
            expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(frame.codeLineNumber!).toBeLessThan(bridgesOnline.pseudocode!.length);
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

    it("reports exactly the true bridges after every insertion", () => {
        let seed = 97;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 15; trial += 1) {
            const n = 5 + (rand() % 2);
            const vertices = Array.from({ length: n }, (_, i) => i);
            const all: Array<[number, number]> = [];
            for (let u = 0; u < n; u += 1) {
                for (let v = u + 1; v < n; v += 1) {
                    if (rand() % 2 === 0) all.push([u, v]);
                }
            }
            for (const frame of bridgesOnline.run({ vertices, edges: all })) {
                const nodeIds = frame.entities.map((e) => e.id.replace("node-", ""));
                const edges = frame.edges.map((e) => ({
                    id: e.id,
                    a: e.sourceId.replace("node-", ""),
                    b: e.targetId.replace("node-", ""),
                }));
                const reported = new Set(frame.edges.filter((e) => e.state === "path").map((e) => e.id));
                expect(reported).toEqual(referenceBridges(nodeIds, edges));
            }
        }
    });
});
