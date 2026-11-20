import { describe, expect, it } from "vitest";
import mod from "./markov-cluster-graph";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

type Matrix = number[][];
const normalize = (m: Matrix): Matrix => {
    const out = m.map((row) => [...row]);
    for (let c = 0; c < out.length; c += 1) {
        const total = out.reduce((sum, row) => sum + (row[c] ?? 0), 0);
        if (total > 0) out.forEach((row) => { row[c] = (row[c] ?? 0) / total; });
    }
    return out;
};
const square = (m: Matrix): Matrix => m.map((row, i) => m[0]!.map((_, j) => row.reduce((sum, value, k) => sum + value * (m[k]![j] ?? 0), 0)));
const inflate = (m: Matrix): Matrix => normalize(m.map((row) => row.map((v) => Math.pow(v, 2))));
const diff = (a: Matrix, b: Matrix): number => a.reduce((worst, row, i) => Math.max(worst, ...row.map((v, j) => Math.abs(v - (b[i]![j] ?? 0)))), 0);
const components = (m: Matrix): string[][] => {
    const n = m.length;
    const seen = new Set<number>();
    const groups: string[][] = [];
    for (let s = 0; s < n; s += 1) {
        if (seen.has(s)) continue;
        const stack = [s];
        const group: number[] = [];
        seen.add(s);
        while (stack.length) {
            const cur = stack.pop()!;
            group.push(cur);
            for (let o = 0; o < n; o += 1) {
                if (!seen.has(o) && ((m[cur]![o] ?? 0) > 1e-3 || (m[o]![cur] ?? 0) > 1e-3)) {
                    seen.add(o);
                    stack.push(o);
                }
            }
        }
        groups.push(group.sort((a, b) => a - b).map((i) => String.fromCharCode(65 + i)));
    }
    return groups.sort();
};
const canonical = (groups: string[][]): string => groups.map((g) => [...g].sort().join("")).sort().join("|");

/** Independent reference implementation of the MCL iteration. */
function referenceClusters(edges: Array<[string, string]>, iterations = 24): string[][] {
    const labels = [...new Set(edges.flatMap(([a, b]) => [a, b]))].sort();
    const n = labels.length;
    const index = new Map(labels.map((label, i) => [label, i]));
    let matrix = normalize(Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0) + (edges.some(([a, b]) =>
            (index.get(a) === i && index.get(b) === j) || (index.get(a) === j && index.get(b) === i)) ? 1 : 0))));
    for (let step = 0; step < iterations; step += 1) {
        const next = inflate(square(matrix));
        const residual = diff(next, matrix);
        matrix = next;
        if (residual < 1e-6) break;
    }
    return components(matrix);
}

describe("Markov Cluster Algorithm", () => {
    it("matches an independent MCL reference and forms a partition", () => {
        const input = mod.defaultInput as { edges: Array<[string, string]> };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const meta = frames[frames.length - 1]!.meta;
        const clusters = meta["clusters"] as string[][];
        const all = clusters.flat();
        expect(new Set(all).size).toBe(all.length);
        expect([...all].sort()).toEqual([...new Set(input.edges.flat())].sort());
        expect(canonical(clusters)).toBe(canonical(referenceClusters(input.edges)));
        expect(meta["converged"]).toBe(true);
    });

    it("separates two triangles joined by a bridge", () => {
        const edges: Array<[string, string]> = [
            ["A", "B"], ["B", "C"], ["A", "C"], ["C", "D"], ["D", "E"], ["E", "F"], ["D", "F"],
        ];
        const frames = [...mod.run({ edges, iterations: 30 })];
        const clusters = frames[frames.length - 1]!.meta["clusters"] as string[][];
        const clusterOf = (label: string): string[] => clusters.find((group) => group.includes(label)) ?? [];
        expect(clusterOf("A")).toEqual(expect.arrayContaining(["A", "B", "C"]));
        expect(clusterOf("D")).toEqual(expect.arrayContaining(["D", "E", "F"]));
        expect(clusterOf("A")).not.toContain("D");
    });

    it("is deterministic and terminates cleanly", () => {
        const input = mod.defaultInput;
        const first = [...mod.run(input)];
        const second = [...mod.run(input)];
        expect(JSON.stringify(first[first.length - 1]!.meta)).toBe(JSON.stringify(second[second.length - 1]!.meta));
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
