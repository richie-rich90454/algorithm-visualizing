/**
 * graph-of-thoughts.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./graph-of-thoughts";
import type { VisualFrame } from "@/types";

/** Brute-force maximum root-to-leaf path sum over a DAG. */
function bruteForce(scores: number[], edges: Array<[number, number]>): number {
    const children = new Map<number, number[]>();
    for (const [from, to] of edges) {
        children.set(from, [...(children.get(from) ?? []), to]);
    }
    let best = -Infinity;
    const walk = (node: number, sum: number): void => {
        const total = sum + (scores[node] ?? 0);
        const nextChildren = children.get(node) ?? [];
        if (nextChildren.length === 0) {
            best = Math.max(best, total);
            return;
        }
        for (const child of nextChildren) {
            walk(child, total);
        }
    };
    walk(0, 0);
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        frame.edges.forEach((edge) => {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        });
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Graph of Thoughts (Best-First Aggregation)", () => {
    it("finds the true best path when fully expanded", () => {
        const input = mod.defaultInput as {
            scores: number[];
            edges: Array<[number, number]>;
            maxExpansions: number;
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta ?? {};
        expect(final["pathScore"]).toBe(bruteForce(input.scores, input.edges));
    });

    it("returns a valid path whose score sums correctly", () => {
        const input = mod.defaultInput as {
            scores: number[];
            edges: Array<[number, number]>;
        };
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta ?? {};
        const path = final["selectedPath"] as number[];
        expect(path[0]).toBe(0);
        const edgeSet = new Set(input.edges.map(([a, b]) => `${a}-${b}`));
        for (let i = 0; i + 1 < path.length; i += 1) {
            expect(edgeSet.has(`${path[i]}-${path[i + 1]}`)).toBe(true);
        }
        const sum = path.reduce((total, node) => total + (input.scores[node] ?? 0), 0);
        expect(final["pathScore"]).toBe(sum);
    });

    it("agrees with brute force on alternative graphs", () => {
        const graphs = [
            {
                scores: [2, 1, 4, 3, 5],
                edges: [
                    [0, 1],
                    [0, 2],
                    [1, 3],
                    [2, 3],
                    [2, 4],
                ] as Array<[number, number]>,
            },
            {
                scores: [0, 5, 2, 7, 1, 6],
                edges: [
                    [0, 1],
                    [0, 2],
                    [1, 3],
                    [2, 4],
                    [3, 5],
                    [4, 5],
                ] as Array<[number, number]>,
            },
        ];
        for (const graph of graphs) {
            const frames = [...mod.run({ ...graph, maxExpansions: graph.scores.length })];
            const final = frames[frames.length - 1]?.meta ?? {};
            expect(final["pathScore"]).toBe(bruteForce(graph.scores, graph.edges));
        }
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
