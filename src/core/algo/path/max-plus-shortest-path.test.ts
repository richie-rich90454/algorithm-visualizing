/**
 * max-plus-shortest-path.test.ts - Brute-force walk enumeration check, frame
 * shape validation, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./max-plus-shortest-path";
import type { VisualFrame } from "@/types";

type Weighted = Record<string, Array<[string, number]>>;
const NEG = -1e9;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function labelsOf(graph: Weighted): string[] {
    return [...new Set([...Object.keys(graph), ...Object.values(graph).flat().map((p) => p[0])])].sort();
}

/** Independent reference: enumerate every walk of exactly `steps` edges. */
function bruteForce(graph: Weighted, labels: string[], steps: number): number[][] {
    const n = labels.length;
    const result: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(-Infinity));
    for (let start = 0; start < n; start += 1) {
        const walk = (current: number, left: number, acc: number): void => {
            if (left === 0) {
                result[start]![current] = Math.max(result[start]![current] as number, acc);
                return;
            }
            for (const [target, weight] of graph[labels[current] as string] ?? []) {
                const next = labels.indexOf(target);
                if (next >= 0) {
                    walk(next, left - 1, acc + weight);
                }
            }
        };
        walk(start, steps, 0);
    }
    return result;
}

describe("Max-Plus Matrix Powers", () => {
    const graph: Weighted = {
        A: [
            ["B", 3],
            ["C", 1],
        ],
        B: [
            ["D", 2],
            ["E", 5],
        ],
        C: [
            ["D", 4],
            ["E", 1],
        ],
        D: [["E", 2]],
        E: [],
    };

    it("matches brute-force walk weights on the default graph", () => {
        const labels = labelsOf(graph);
        for (const steps of [0, 1, 2, 3, 4]) {
            const frames = [...mod.run({ graph, steps })];
            checkFrames(frames);
            const last = frames[frames.length - 1]?.meta;
            const matrix = last?.["matrix"] as number[];
            const expected = bruteForce(graph, labels, steps);
            for (let i = 0; i < labels.length; i += 1) {
                for (let j = 0; j < labels.length; j += 1) {
                    const actual = matrix[i * labels.length + j] as number;
                    const want = expected[i]![j] as number;
                    if (want === -Infinity) {
                        expect(actual).toBe(NEG);
                    } else {
                        expect(actual).toBe(want);
                    }
                }
            }
        }
    });

    it("matches brute force on a cyclic graph with negative weights", () => {
        const cyclic: Weighted = {
            X: [
                ["X", -1],
                ["Y", 4],
            ],
            Y: [["X", 2]],
        };
        const labels = labelsOf(cyclic);
        for (const steps of [1, 2, 3, 5]) {
            const frames = [...mod.run({ graph: cyclic, steps })];
            checkFrames(frames);
            const matrix = (frames[frames.length - 1]?.meta["matrix"]) as number[];
            const expected = bruteForce(cyclic, labels, steps);
            for (let i = 0; i < labels.length; i += 1) {
                for (let j = 0; j < labels.length; j += 1) {
                    const want = expected[i]![j] as number;
                    const actual = matrix[i * labels.length + j] as number;
                    if (want === -Infinity) {
                        expect(actual).toBe(NEG);
                    } else {
                        expect(actual).toBe(want);
                    }
                }
            }
        }
    });

    it("reports a walk whose weight matches the maximum entry", () => {
        const frames = [...mod.run({ graph, steps: 3 })];
        const last = frames[frames.length - 1]?.meta;
        const walk = last?.["walk"] as string[];
        const bestWeight = Number(last?.["bestWeight"]);
        expect(walk).toHaveLength(4);
        expect(walk[0]).toBe("A");
        let total = 0;
        for (let i = 0; i + 1 < walk.length; i += 1) {
            const edge = (graph[walk[i] as string] ?? []).find(([target]) => target === walk[i + 1]);
            expect(edge).toBeDefined();
            total += edge?.[1] ?? 0;
        }
        expect(total).toBe(bestWeight);
    });

    it("handles an empty graph and a case with no walk of that length", () => {
        const empty = [...mod.run({ graph: {}, steps: 2 })];
        checkFrames(empty);
        expect(empty[empty.length - 1]?.meta["walk"]).toEqual([]);

        const noWalk = [...mod.run({ graph: { A: [], B: [] }, steps: 1 })];
        checkFrames(noWalk);
        expect(Number(noWalk[noWalk.length - 1]?.meta["bestWeight"])).toBe(0);
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
