/**
 * pregel.test.ts - Bellman-Ford cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./pregel";
import type { VisualFrame } from "@/types";

interface EdgeSpec { source: string; target: string; weight: number }
const INF = Number.POSITIVE_INFINITY;

/** Independent Bellman-Ford shortest distances. */
function bellmanFord(vertices: string[], edges: EdgeSpec[], source: string): Map<string, number> {
    const dist = new Map<string, number>(vertices.map((v) => [v, INF]));
    dist.set(source, 0);
    for (let i = 0; i < vertices.length - 1; i += 1) {
        let changed = false;
        for (const e of edges) {
            const via = (dist.get(e.source) ?? INF) + e.weight;
            if (via < (dist.get(e.target) ?? INF)) {
                dist.set(e.target, via);
                changed = true;
            }
        }
        if (!changed) break;
    }
    return dist;
}

function checkFrames(frames: VisualFrame[], vertices: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(vertices);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Pregel", () => {
    it("converges to Bellman-Ford shortest paths", () => {
        const cases: Array<{ vertices: string[]; edges: EdgeSpec[]; source: string }> = [
            {
                vertices: ["A", "B", "C", "D", "E"],
                edges: [
                    { source: "A", target: "B", weight: 4 },
                    { source: "A", target: "C", weight: 2 },
                    { source: "C", target: "B", weight: 1 },
                    { source: "B", target: "D", weight: 5 },
                    { source: "C", target: "D", weight: 8 },
                    { source: "D", target: "E", weight: 2 },
                ],
                source: "A",
            },
            {
                vertices: ["S", "T", "U", "V"],
                edges: [
                    { source: "S", target: "T", weight: 1 },
                    { source: "T", target: "U", weight: 2 },
                    { source: "U", target: "V", weight: 3 },
                    { source: "S", target: "V", weight: 10 },
                    { source: "V", target: "T", weight: 1 },
                ],
                source: "S",
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ ...testCase, maxSupersteps: 20 })];
            checkFrames(frames, testCase.vertices.length);
            const expected = bellmanFord(testCase.vertices, testCase.edges, testCase.source);
            const final = JSON.parse(
                String(frames[frames.length - 1]?.meta["distances"] ?? "{}"),
            ) as Record<string, number>;
            for (const v of testCase.vertices) {
                const want = expected.get(v) ?? INF;
                const got = final[v] ?? -1;
                if (Number.isFinite(want)) {
                    expect(got).toBe(want);
                } else {
                    expect(got).toBe(-1);
                }
            }
            expect(frames[frames.length - 1]?.meta["converged"]).toBe(true);
        }
    });

    it("the source sends its messages in the first superstep", () => {
        const frames = [...mod.run({ vertices: ["A", "B"], edges: [{ source: "A", target: "B", weight: 7 }], source: "A" })];
        const firstSuperstep = frames[1];
        expect(firstSuperstep?.meta["superstep"]).toBe(1);
        expect(firstSuperstep?.edges.length).toBe(1);
        expect(JSON.parse(String(firstSuperstep?.meta["distances"] ?? "{}"))).toEqual({ A: 0, B: -1 });
        const final = JSON.parse(String(frames[frames.length - 1]?.meta["distances"] ?? "{}")) as Record<string, number>;
        expect(final["B"]).toBe(7);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
