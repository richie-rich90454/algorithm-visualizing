/** boyer-myrvold-planarity.test.ts - Euler certificate, nonplanar exhaustiveness, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./boyer-myrvold-planarity";

type Graph = Record<string, string[]>;

function collect(input: unknown) {
    return [...mod.run(input)];
}

function completeGraph(n: number): Graph {
    const names = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
    const g: Graph = {};
    for (const v of names) g[v] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            g[names[i]!]!.push(names[j]!);
            g[names[j]!]!.push(names[i]!);
        }
    }
    return g;
}

function bipartiteGraph(a: number, b: number): Graph {
    const left = Array.from({ length: a }, (_, i) => `L${i}`);
    const right = Array.from({ length: b }, (_, i) => `R${i}`);
    const g: Graph = {};
    for (const v of [...left, ...right]) g[v] = [];
    for (const l of left) for (const r of right) {
        g[l]!.push(r);
        g[r]!.push(l);
    }
    return g;
}

describe("BoyerMyrvoldPlanarity", () => {
    it("yields well-formed graph frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        expect(frames.length).toBeGreaterThan(4);
        frames.forEach((f, index) => {
            expect(f.stepNumber).toBe(index);
            expect(f.description.length).toBeGreaterThanOrEqual(10);
            expect(f.layout).toBe("graph");
            expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(f.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
            expect(f.meta).toBeDefined();
            expect(f.entities.every((e) => e.type === "node")).toBe(true);
        });
    });

    it("classifies known planar and nonplanar graphs correctly", () => {
        const cycle: Graph = { A: ["B", "E"], B: ["A", "C"], C: ["B", "D"], D: ["C", "E"], E: ["D", "A"] };
        const tree: Graph = { A: ["B", "C"], B: ["A", "D"], C: ["A"], D: ["B"] };
        const squareChord: Graph = { A: ["B", "D", "C"], B: ["A", "C"], C: ["B", "D", "A"], D: ["C", "A"] };
        const cases: Array<[Graph, boolean]> = [
            [completeGraph(4), true],
            [cycle, true],
            [tree, true],
            [squareChord, true],
            [completeGraph(5), false],
            [bipartiteGraph(3, 3), false],
        ];
        for (const [graph, expected] of cases) {
            const last = collect({ graph }).at(-1)!;
            expect(last.meta.planar).toBe(expected);
        }
    });

    it("supplies a valid Euler certificate for every planar verdict", () => {
        const graphs: Graph[] = [
            completeGraph(4),
            { A: ["B", "E"], B: ["A", "C"], C: ["B", "D"], D: ["C", "E"], E: ["D", "A"] },
            { A: ["B", "C"], B: ["A", "D"], C: ["A"], D: ["B"] },
            (mod.defaultInput as { graph: Graph }).graph,
        ];
        for (const graph of graphs) {
            const last = collect({ graph }).at(-1)!;
            expect(last.meta.planar).toBe(true);
            const n = last.meta.vertices as number;
            const m = last.meta.edges as number;
            const f = last.meta.faces as number;
            const components = last.meta.components as number;
            expect(n - m + f).toBe(1 + components);
            expect(last.meta.exact).toBe(true);
        }
    });

    it("proves nonplanarity either by Euler's bound or by exhausting all rotation systems", () => {
        const graphs: Graph[] = [completeGraph(5), bipartiteGraph(3, 3)];
        for (const graph of graphs) {
            const frames = collect({ graph });
            const last = frames.at(-1)!;
            expect(last.meta.planar).toBe(false);
            const eulerFrame = frames.find((f) => "eulerBound" in f.meta);
            if (eulerFrame?.meta.eulerBound === true) {
                expect(last.meta.systemsChecked).toBe(0);
            } else {
                expect(last.meta.exact).toBe(true);
                expect(last.meta.systemsChecked).toBe(last.meta.systemsTotal);
            }
        }
    });

    it("handles trivial inputs", () => {
        expect(collect({ graph: {} }).at(-1)!.meta.planar).toBe(true);
        expect(collect({ graph: { A: [] } }).at(-1)!.meta.planar).toBe(true);
    });
});
