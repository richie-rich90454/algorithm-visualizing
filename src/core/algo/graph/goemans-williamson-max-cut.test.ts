/** goemans-williamson-max-cut.test.ts - Rounding expectation, cut validity, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./goemans-williamson-max-cut";

function collect(input: unknown) {
    return [...mod.run(input)];
}

function uniqueEdges(graph: Record<string, Array<[string, number]>>) {
    const seen = new Set<string>();
    const edges: Array<{ u: string; v: string; w: number }> = [];
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat().map((p) => p[0])])].sort();
    for (const [u, list] of Object.entries(graph)) {
        for (const [v, w] of list) {
            const key = u < v ? `${u}-${v}` : `${v}-${u}`;
            if (u === v || seen.has(key)) continue;
            seen.add(key);
            edges.push({ u, v, w });
        }
    }
    return { edges, labels };
}

describe("GoemansWilliamsonMaxCut", () => {
    it("yields well-formed point-layout frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(4);
        frames.forEach((f, index) => {
            expect(f.stepNumber).toBe(index);
            expect(f.description.length).toBeGreaterThanOrEqual(10);
            expect(f.layout).toBe("point");
            expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(f.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(f.meta).toBeDefined();
            expect(f.entities.every((e) => e.type === "node")).toBe(true);
            f.entities.forEach((e) => {
                const val = e.value as number[];
                expect(Number.isFinite(val[0]!)).toBe(true);
                expect(Number.isFinite(val[1]!)).toBe(true);
                expect(Math.abs(Math.hypot(val[0]!, val[1]!) - 1)).toBeLessThan(1e-6);
            });
        });
    });

    it("reports a genuine cut consistent with its sides", () => {
        const frames = collect(mod.defaultInput);
        const last = frames.at(-1)!;
        const sides = last.meta.sides as number[];
        const graph = (mod.defaultInput as { graph: Record<string, Array<[string, number]>> }).graph;
        const { edges, labels } = uniqueEdges(graph);
        expect(sides).toHaveLength(labels.length);
        let cut = 0;
        for (const e of edges) {
            if (sides[labels.indexOf(e.u)] !== sides[labels.indexOf(e.v)]) cut += e.w;
        }
        expect(cut).toBe(last.meta.bestCut);
        expect(cut).toBeGreaterThanOrEqual(0);
        expect(cut).toBeLessThanOrEqual(last.meta.totalWeight as number);
    });

    it("rounding mean matches the theoretical expectation and the 0.878 guarantee", () => {
        const input = { ...(mod.defaultInput as object), samples: 400, seed: 99 };
        const last = collect(input).at(-1)!;
        const expected = last.meta.expectedCut as number;
        const mean = last.meta.meanCut as number;
        const sdp = last.meta.sdpValue as number;
        expect(expected).toBeGreaterThan(0);
        expect(Math.abs(mean - expected) / expected).toBeLessThan(0.12);
        expect(expected).toBeGreaterThanOrEqual(0.87 * sdp);
        expect(last.meta.bestCut).toBeGreaterThanOrEqual(mean * 0.5);
    });

    it("handles trivial graphs without throwing", () => {
        for (const graph of [{}, { A: [] }, { A: [["A", 1]] }]) {
            const last = collect({ graph }).at(-1)!;
            expect(last.meta.bestCut).toBe(0);
            expect(last.entities.length).toBeLessThanOrEqual(1);
        }
    });
});
