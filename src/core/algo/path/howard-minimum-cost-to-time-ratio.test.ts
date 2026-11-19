/**
 * howard-minimum-cost-to-time-ratio.test.ts - Exhaustive cycle-ratio cross-check.
 */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./howard-minimum-cost-to-time-ratio";

type GraphInput = Record<string, Array<[string, number, number]>>;

function bruteMinimumRatio(graph: GraphInput): number {
    let best = Number.POSITIVE_INFINITY;
    for (const start of Object.keys(graph)) {
        const visit = (vertex: string, visited: Set<string>, cost: number, time: number): void => {
            for (const [to, c, t] of graph[vertex] ?? []) {
                if (to === start) {
                    best = Math.min(best, (cost + c) / (time + t));
                } else if (!visited.has(to)) {
                    const next = new Set(visited);
                    next.add(to);
                    visit(to, next, cost + c, time + t);
                }
            }
        };
        visit(start, new Set([start]), 0, 0);
    }
    return Number.isFinite(best) ? best : 0;
}

function verifyFrameShapes(frames: VisualFrame[]): void {
    const lineCount = module.pseudocode?.length ?? 1;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lineCount);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Howard Minimum Cost-to-Time Ratio Cycle", () => {
    it("matches exhaustive simple-cycle enumeration", () => {
        const names = ["A", "B", "C", "D", "E"];
        for (let trial = 0; trial < 50; trial += 1) {
            const n = 3 + (trial % 3);
            const graph: GraphInput = {};
            for (let i = 0; i < n; i += 1) {
                const from = names[i] ?? "A";
                const targets: Array<[string, number, number]> = [];
                const degree = 1 + Math.floor(Math.random() * 2);
                for (let d = 0; d < degree; d += 1) {
                    targets.push([
                        names[Math.floor(Math.random() * n)] ?? "A",
                        Math.floor(Math.random() * 9) - 4,
                        1 + Math.floor(Math.random() * 3),
                    ]);
                }
                graph[from] = targets;
            }
            const frames = [...module.run({ graph })];
            verifyFrameShapes(frames);
            const final = frames[frames.length - 1];
            expect(final).toBeDefined();
            expect(Number(final?.meta.ratio)).toBeCloseTo(bruteMinimumRatio(graph), 9);
        }
    });

    it("handles a single self-loop and a positive-cycle graph", () => {
        const loop = [...module.run({ graph: { A: [["A", -2, 3]] } })];
        expect(Number(loop[loop.length - 1]?.meta.ratio)).toBeCloseTo(-2 / 3, 9);
        verifyFrameShapes(loop);
        const positive = [...module.run({ graph: { A: [["B", 2, 1]], B: [["A", 3, 1]] } })];
        expect(Number(positive[positive.length - 1]?.meta.ratio)).toBeCloseTo(2.5, 9);
    });

    it("terminates with sequential step numbers", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((frame, index) => expect(frame.stepNumber).toBe(index));
    });
});
