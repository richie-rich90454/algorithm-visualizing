/**
 * min-plus-matrix-multiplication-apsp.test.ts - Floyd-Warshall cross-check.
 */

import { describe, expect, it } from "vitest";
import mod from "./min-plus-matrix-multiplication-apsp";
import type { VisualFrame } from "@/types";

type Graph = Record<string, Array<[string, number]>>;

function floydWarshall(graph: Graph): number[][] {
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flatMap((l) => l.map(([v]) => v))])];
    const index = new Map(labels.map((v, i) => [v, i]));
    const d = labels.map((_, i) => labels.map((_, j) => (i === j ? 0 : Infinity)));
    for (const [u, list] of Object.entries(graph)) {
        for (const [v, w] of list) {
            const i = index.get(u)!;
            const j = index.get(v)!;
            d[i]![j] = Math.min(d[i]![j] ?? Infinity, w);
        }
    }
    for (let k = 0; k < labels.length; k += 1) {
        for (let i = 0; i < labels.length; i += 1) {
            for (let j = 0; j < labels.length; j += 1) {
                d[i]![j] = Math.min(d[i]![j] ?? Infinity, (d[i]![k] ?? Infinity) + (d[k]![j] ?? Infinity));
            }
        }
    }
    return d;
}

function checkFrames(frames: VisualFrame[], size: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect((frame.meta["result"] as number[]).length).toBe(size * size);
    });
}

describe("Min-plus matrix multiplication APSP", () => {
    it("matches Floyd-Warshall on the default graph", () => {
        const graph = (mod.defaultInput as { graph: Graph }).graph;
        const frames = [...mod.run({ graph })];
        const labels = (frames[0]!.meta["labels"] as string[]);
        checkFrames(frames, labels.length);
        const expected = floydWarshall(graph);
        const result = frames[frames.length - 1]!.meta["result"] as number[];
        result.forEach((value, i) => {
            const truth = expected[Math.floor(i / labels.length)]![i % labels.length]!;
            expect(value).toBe(Number.isFinite(truth) ? truth : -1);
        });
    });

    it("matches Floyd-Warshall on random graphs", () => {
        let seed = 59;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483647;
            return seed / 2147483647;
        };
        for (let t = 0; t < 6; t += 1) {
            const names = ["A", "B", "C", "D", "E"].slice(0, 3 + Math.floor(rand() * 3));
            const graph: Graph = {};
            for (const u of names) {
                graph[u] = [];
                for (const v of names) {
                    if (u !== v && rand() < 0.5) {
                        graph[u]!.push([v, 1 + Math.floor(rand() * 9)]);
                    }
                }
            }
            const frames = [...mod.run({ graph })];
            const labels = frames[0]!.meta["labels"] as string[];
            checkFrames(frames, labels.length);
            const expected = floydWarshall(graph);
            const result = frames[frames.length - 1]!.meta["result"] as number[];
            result.forEach((value, i) => {
                const truth = expected[Math.floor(i / labels.length)]![i % labels.length]!;
                expect(value).toBe(Number.isFinite(truth) ? truth : -1);
            });
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
