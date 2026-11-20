/** Correctness, frame shape, and termination checks for TrustRank. */
import { describe, expect, it } from "vitest";
import mod from "./trustrank";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
    });
}

/** Independent power iteration of the TrustRank fixed point. */
function reference(
    edges: Array<[string, string]>,
    seeds: string[],
    beta: number,
): Record<string, number> {
    const vertices = [...new Set(edges.flatMap(([a, b]) => [a, b]))].sort();
    const out: Record<string, string[]> = {};
    const inc: Record<string, string[]> = {};
    for (const v of vertices) { out[v] = []; inc[v] = []; }
    for (const [a, b] of edges) { out[a]?.push(b); inc[b]?.push(a); }
    let score: Record<string, number> = {};
    for (const v of vertices) score[v] = seeds.includes(v) ? 1 / Math.max(1, seeds.length) : 0;
    for (let it = 0; it < 500; it += 1) {
        const next: Record<string, number> = {};
        for (const v of vertices) {
            let incoming = 0;
            for (const u of inc[v] ?? []) {
                const deg = (out[u] ?? []).length;
                if (deg > 0) incoming += (score[u] ?? 0) / deg;
            }
            next[v] = (1 - beta) * (seeds.includes(v) ? 1 / Math.max(1, seeds.length) : 0) + beta * incoming;
        }
        score = next;
    }
    return score;
}

describe("TrustRank", () => {
    const cases: Array<{ edges: Array<[string, string]>; goodSeeds: string[]; beta: number }> = [
        { edges: [["A", "B"], ["B", "C"], ["C", "A"]], goodSeeds: ["A"], beta: 0.85 },
        { edges: [["A", "B"], ["A", "C"], ["B", "C"], ["C", "D"], ["D", "E"], ["E", "A"], ["F", "A"], ["G", "F"]], goodSeeds: ["A"], beta: 0.85 },
        { edges: [["X", "Y"], ["X", "Z"], ["Y", "Z"], ["Z", "X"]], goodSeeds: ["X", "Z"], beta: 0.6 },
        { edges: [["A", "B"], ["B", "A"]], goodSeeds: ["B"], beta: 0.9 },
    ];

    for (const input of cases) {
        it(`matches an independent power iteration for ${JSON.stringify(input.goodSeeds)}`, () => {
            const frames = [...mod.run({ ...input, iterations: 400 })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["converged"]).toBe(true);
            const scores = final?.["scores"] as number[];
            const labels = final?.["labels"] as string[];
            expect(scores.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
            const expected = reference(input.edges, input.goodSeeds, input.beta);
            labels.forEach((label, index) => {
                expect(scores[index] ?? 0).toBeCloseTo(expected[label] ?? 0, 5);
            });
        });
    }

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
