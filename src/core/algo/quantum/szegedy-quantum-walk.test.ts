/**
 * szegedy-quantum-walk.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./szegedy-quantum-walk";
import type { VisualFrame } from "@/types";

type Graph = Record<string, string[]>;

function matMul(a: number[][], b: number[][]): number[][] {
    const n = a.length;
    const out = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            for (let k = 0; k < n; k += 1) {
                out[i][j] = (out[i][j] ?? 0) + (a[i][k] ?? 0) * (b[k][j] ?? 0);
            }
        }
    }
    return out;
}

function apply(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0));
}

/** Independent explicit construction of the Szegedy walk matrix. */
function walkMatrix(graph: Graph) {
    const nodes = Object.keys(graph).sort();
    const idx = new Map(nodes.map((node, i) => [node, i]));
    const edges: Array<{ from: number; to: number }> = [];
    for (const v of nodes) {
        for (const u of graph[v] ?? []) {
            const from = idx.get(v);
            const to = idx.get(u);
            if (from !== undefined && to !== undefined && from !== to) {
                edges.push({ from, to });
            }
        }
    }
    const m = edges.length;
    const basis: number[][] = nodes.map((v) => {
        const vector = new Array<number>(m).fill(0);
        const deg = (graph[v] ?? []).length;
        if (deg > 0) {
            edges.forEach((e, i) => {
                if (nodes[e.from] === v) {
                    vector[i] = 1 / Math.sqrt(deg);
                }
            });
        }
        return vector;
    });
    const pi = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    for (const b of basis) {
        for (let i = 0; i < m; i += 1) {
            for (let j = 0; j < m; j += 1) {
                pi[i][j] = (pi[i][j] ?? 0) + (b[i] ?? 0) * (b[j] ?? 0);
            }
        }
    }
    const r = pi.map((row, i) => row.map((value, j) => 2 * value - (i === j ? 1 : 0)));
    const s = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    const lookup = new Map(edges.map((e, i) => [`${e.from}-${e.to}`, i]));
    edges.forEach((e, i) => {
        const target = lookup.get(`${e.to}-${e.from}`);
        if (target !== undefined) {
            s[target][i] = 1;
        }
    });
    const w = matMul(matMul(matMul(s, r), s), r);
    return { nodes, edges, basis, w };
}

function vertexProbs(state: number[], edges: Array<{ from: number; to: number }>, count: number): number[] {
    const out = new Array<number>(count).fill(0);
    edges.forEach((e, i) => {
        out[e.from] = (out[e.from] ?? 0) + (state[i] ?? 0) ** 2;
    });
    return out;
}

function checkFrames(frames: VisualFrame[], vertices: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(vertices);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["vertices"]).toBe(vertices);
    });
}

describe("Szegedy Quantum Walk", () => {
    it("matches an explicit walk matrix and preserves normalization", () => {
        const graph: Graph = {
            "0": ["1", "2"],
            "1": ["0", "2"],
            "2": ["0", "1"],
        };
        const input = { graph, start: "0", steps: 5 };
        const frames = [...mod.run(input)];
        checkFrames(frames, 3);

        const { edges, basis, w } = walkMatrix(graph);
        const state = new Array<number>(edges.length).fill(0);
        basis[0]?.forEach((value, i) => {
            state[i] = value;
        });

        const wt = w[0]?.map((_, j) => w.map((row) => row[j] ?? 0)) ?? [];
        const identity = matMul(wt, w);
        for (let i = 0; i < identity.length; i += 1) {
            for (let j = 0; j < identity.length; j += 1) {
                expect(identity[i][j]).toBeCloseTo(i === j ? 1 : 0, 10);
            }
        }

        let evolved = [...state];
        for (let t = 0; t < 5; t += 1) {
            evolved = apply(w, evolved);
        }
        const expected = vertexProbs(evolved, edges, 3);
        const actual = (frames[frames.length - 2]?.entities ?? []).map((e) => Number(e.value));
        expect(actual.length).toBe(3);
        actual.forEach((value, i) => {
            expect(value).toBeCloseTo(expected[i] ?? 0, 10);
        });
        expect(actual.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    });

    it("stays normalized on a path graph across many steps", () => {
        const graph: Graph = {
            "0": ["1"],
            "1": ["0", "2"],
            "2": ["1", "3"],
            "3": ["2"],
        };
        const frames = [...mod.run({ graph, start: "0", steps: 8 })];
        checkFrames(frames, 4);
        for (const frame of frames) {
            const total = frame.entities.reduce((sum, e) => sum + Number(e.value), 0);
            expect(total).toBeCloseTo(1, 10);
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
