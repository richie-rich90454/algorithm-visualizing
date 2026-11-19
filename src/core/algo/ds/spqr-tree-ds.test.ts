/**
 * spqr-tree-ds.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./spqr-tree-ds";
import type { VisualFrame } from "@/types";

type Edges = Array<[string, string]>;

/** Brute-force count of edge-distinct simple paths from s to t. */
function brutePaths(edges: Edges, s: string, t: string): number {
    const adj = new Map<string, string[]>();
    for (const [u, v] of edges) {
        adj.set(u, [...(adj.get(u) ?? []), v]);
        adj.set(v, [...(adj.get(v) ?? []), u]);
    }
    const dfs = (v: string, seen: Set<string>): number => {
        if (v === t) {
            return 1;
        }
        let total = 0;
        for (const next of adj.get(v) ?? []) {
            if (seen.has(next)) {
                continue;
            }
            seen.add(next);
            total += dfs(next, seen);
            seen.delete(next);
        }
        return total;
    };
    return dfs(s, new Set([s]));
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["s"]).toBeDefined();
    });
}

describe("SPQR Tree (Series-Parallel Reduction)", () => {
    it("matches brute-force path counts on series-parallel graphs", () => {
        const cases: Array<{ edges: Edges; s: string; t: string }> = [
            {
                edges: [
                    ["A", "B"],
                    ["A", "B"],
                    ["B", "C"],
                    ["C", "D"],
                    ["C", "D"],
                    ["D", "F"],
                ],
                s: "A",
                t: "F",
            },
            {
                edges: [
                    ["A", "B"],
                    ["B", "C"],
                    ["A", "C"],
                    ["C", "D"],
                ],
                s: "A",
                t: "D",
            },
            {
                edges: [
                    ["A", "B"],
                    ["A", "B"],
                    ["B", "C"],
                    ["B", "C"],
                ],
                s: "A",
                t: "C",
            },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["complete"]).toBe(1);
            expect(final?.["pathCount"]).toBe(brutePaths(testCase.edges, testCase.s, testCase.t));
        }
    });

    it("reports a rigid block instead of a wrong answer", () => {
        const edges: Edges = [
            ["A", "B"],
            ["A", "C"],
            ["A", "D"],
            ["B", "C"],
            ["B", "D"],
            ["C", "D"],
        ];
        const frames = [...mod.run({ edges, s: "A", t: "D" })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["complete"]).toBe(0);
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
