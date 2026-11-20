/**
 * gated-graph-attention.test.ts - Brute-force GAT recomputation, attention
 * properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { gatedGraphAttention } from "./gated-graph-attention";
import type { VisualFrame, VisualEdge } from "@/types";

const STATES = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

function reference(values: number[], edges: Array<[number, number]>, selfLoop: boolean, a: number, leaky: number, wg: number, bg: number) {
    const n = values.length;
    const neigh: number[][] = Array.from({ length: n }, () => []);
    for (const [u, v] of edges) {
        if (u >= 0 && u < n && v >= 0 && v < n && u !== v) {
            neigh[u].push(v);
            neigh[v].push(u);
        }
    }
    if (selfLoop) for (let i = 0; i < n; i += 1) neigh[i].unshift(i);
    const alphas: number[][] = [];
    const agg: number[] = [];
    const gates: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const scores = neigh[i].map((j) => {
            const s = a * values[i] * values[j];
            return s >= 0 ? s : leaky * s;
        });
        const max = Math.max(...scores);
        const exps = scores.map((s) => Math.exp(s - max));
        const total = exps.reduce((x, y) => x + y, 0);
        const row = exps.map((e) => e / total);
        let m = 0;
        for (let k = 0; k < neigh[i].length; k += 1) m += row[k] * values[neigh[i][k]];
        const gate = 1 / (1 + Math.exp(-(wg * (values[i] + m) + bg)));
        alphas.push(row);
        agg.push(m);
        gates.push(gate);
        out.push(gate * m + (1 - gate) * values[i]);
    }
    return { alphas, agg, gates, out };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) expect(STATES.has(entity.state)).toBe(true);
        const entityIds = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges as VisualEdge[]) {
            expect(entityIds.has(edge.sourceId)).toBe(true);
            expect(entityIds.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Gated graph attention", () => {
    it("matches an independent attention recomputation on random graphs", () => {
        for (let seed = 0; seed < 12; seed += 1) {
            const n = 3 + (seed % 3);
            const values = Array.from({ length: n }, (_, i) => ((i * 7 + seed * 3) % 11) / 5 - 1);
            const edges: Array<[number, number]> = [];
            for (let i = 0; i + 1 < n; i += 1) {
                if ((i + seed) % 2 === 0) edges.push([i, i + 1]);
            }
            edges.push([0, n - 1]);
            const opts = { selfLoop: seed % 2 === 0, a: 0.5 + seed / 10, leaky: 0.2, wg: 1, bg: 0 };
            const got = gatedGraphAttention(values, edges, opts);
            const ref = reference(values, edges, opts.selfLoop, opts.a, opts.leaky, opts.wg, opts.bg);
            expect(got.alphas).toEqual(ref.alphas);
            expect(got.aggregated).toEqual(ref.agg);
            expect(got.gates).toEqual(ref.gates);
            expect(got.output).toEqual(ref.out);
        }
    });

    it("normalizes attention and bounds gates", () => {
        const out = gatedGraphAttention([1, -2, 3], [[0, 1], [1, 2]]);
        for (const row of out.alphas) {
            expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
            for (const w of row) expect(w).toBeGreaterThanOrEqual(0);
        }
        for (const g of out.gates) {
            expect(g).toBeGreaterThan(0);
            expect(g).toBeLessThan(1);
        }
        expect(out.alphas.every((row) => row.length >= 1)).toBe(true);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames[0]?.edges.length).toBeGreaterThan(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
