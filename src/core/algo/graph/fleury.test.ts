import { describe, expect, it } from "vitest";
import mod from "./fleury";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Check that the reported path is a genuine Eulerian trail of the edge list. */
function verifyTrail(edges: Array<[string, string]>, path: string[]): void {
    const unused = new Set(edges.map(([a, b]) => [a, b].sort().join("|")));
    expect(path).toHaveLength(edges.length + 1);
    for (let i = 0; i + 1 < path.length; i += 1) {
        const key = [path[i], path[i + 1]].sort().join("|");
        expect(unused.has(key)).toBe(true);
        unused.delete(key);
    }
    expect(unused.size).toBe(0);
}

describe("Fleury Eulerian Trail", () => {
    it("finds a valid open Eulerian trail starting at an odd vertex", () => {
        const edges: Array<[string, string]> = [["A", "B"], ["A", "C"], ["B", "C"], ["C", "D"]];
        const frames = [...mod.run({ edges })];
        checkFrames(frames);
        const meta = frames[frames.length - 1]?.meta;
        const path = meta?.["path"] as string[];
        verifyTrail(edges, path);
        expect(meta?.["usedEdges"]).toHaveLength(edges.length);
        expect(meta?.["remaining"]).toBe(0);
        expect(path[0]).toBe("C");
        expect(path[path.length - 1]).toBe("D");
    });

    it("finds a closed circuit when all degrees are even", () => {
        const edges: Array<[string, string]> = [
            ["A", "B"], ["B", "C"], ["C", "A"], ["C", "D"], ["D", "E"], ["E", "C"],
        ];
        const frames = [...mod.run({ edges })];
        const meta = frames[frames.length - 1]?.meta;
        const path = meta?.["path"] as string[];
        verifyTrail(edges, path);
        expect(meta?.["oddVertices"]).toEqual([]);
        expect(path[0]).toBe(path[path.length - 1]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
