/**
 * parallel-page-rank.test.ts - Independent transition-matrix reference,
 * stochasticity property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./parallel-page-rank";
import type { VisualFrame } from "@/types";

type Link = [number, number];

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent reference using a dense column-stochastic transition matrix. */
function reference(n: number, edges: Link[], damping: number, iterations: number): number[] {
    const degree = new Array<number>(n).fill(0);
    for (const [u, v] of edges) {
        if (u >= 0 && u < n && v >= 0 && v < n) {
            degree[u]! += 1;
        }
    }
    const matrix = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (const [u, v] of edges) {
        if (u >= 0 && u < n && v >= 0 && v < n) {
            matrix[v]![u] = 1 / degree[u]!;
        }
    }
    for (let u = 0; u < n; u += 1) {
        if (degree[u] === 0) {
            for (let v = 0; v < n; v += 1) {
                matrix[v]![u] = 1 / n;
            }
        }
    }
    let rank = new Array<number>(n).fill(1 / n);
    for (let i = 0; i < iterations; i += 1) {
        rank = matrix.map((row) =>
            (1 - damping) / n + damping * row.reduce((sum, value, j) => sum + value * rank[j]!, 0),
        );
    }
    return rank;
}

describe("ParallelPageRank", () => {
    it("matches the dense transition-matrix reference", () => {
        const cases = [
            { n: 4, edges: [[0, 1], [0, 2], [1, 2], [2, 0]] as Link[], damping: 0.85 },
            { n: 3, edges: [[0, 1], [1, 2], [2, 0], [2, 1]] as Link[], damping: 0.9 },
        ];
        for (const { n, edges, damping } of cases) {
            const frames = [...mod.run({ nodes: n, edges, damping, iterations: 60, tol: 1e-12 })];
            checkFrames(frames, n);
            const ranks = frames[frames.length - 1]?.meta["ranks"] as number[];
            const expected = reference(n, edges, damping, 60);
            for (let i = 0; i < n; i += 1) {
                expect(ranks[i]).toBeCloseTo(expected[i]!, 8);
            }
            expect(ranks.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
        }
    });

    it("keeps rank vectors stochastic and nonnegative", () => {
        const input = mod.defaultInput as { nodes: number };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.nodes);
        for (const frame of frames) {
            const ranks = frame.meta["ranks"] as number[];
            expect(ranks.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
            expect(ranks.every((value) => value >= 0)).toBe(true);
            expect(Number(frame.meta["sum"])).toBeCloseTo(1, 10);
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
