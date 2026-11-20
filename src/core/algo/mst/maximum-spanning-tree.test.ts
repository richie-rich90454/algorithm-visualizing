import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./maximum-spanning-tree";

type Edge = [string, string, number];

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((f, i) => {
        expect(f.stepNumber).toBe(i);
        expect(f.entities.length).toBeGreaterThan(0);
        expect(f.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(f.edges)).toBe(true);
        expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(f.codeLineNumber).toBeLessThan(module.pseudocode!.length);
        expect(f.layout).toBe(module.visualType);
        expect(f.meta).toBeDefined();
    });
}

function bruteMaxWeight(edges: Edge[]): number {
    const nodes = new Set<string>();
    edges.forEach(([u, v]) => {
        nodes.add(u);
        nodes.add(v);
    });
    const parent = new Map<string, string>([...nodes].map((n) => [n, n]));
    const find = (x: string): string => {
        let r = x;
        while (parent.get(r) !== r) r = parent.get(r)!;
        return r;
    };
    let total = 0;
    let taken = 0;
    for (const [u, v, w] of [...edges].sort((a, b) => b[2] - a[2])) {
        const ru = find(u);
        const rv = find(v);
        if (ru !== rv) {
            parent.set(ru, rv);
            total += w;
            taken += 1;
        }
    }
    expect(taken).toBe(nodes.size - 1);
    return total;
}

describe("Maximum Spanning Tree", () => {
    it("terminates with well-formed frames", () => {
        checkFrames([...module.run(module.defaultInput)]);
    });

    it("matches an independent maximum spanning tree computation", () => {
        const cases: Edge[][] = [
            [["A", "B", 4], ["A", "C", 2], ["B", "C", 3], ["B", "D", 5], ["C", "D", 1]],
            [["A", "B", 1], ["B", "C", 2], ["C", "D", 3], ["D", "A", 4], ["A", "C", 5]],
            [["X", "Y", 7], ["Y", "Z", 8], ["Z", "X", 9], ["X", "W", 2], ["Y", "W", 6]],
        ];
        for (const edges of cases) {
            const frames = [...module.run({ edges })];
            checkFrames(frames);
            const last = frames[frames.length - 1]!;
            expect(last.meta.totalWeight).toBe(bruteMaxWeight(edges));
            const chosen = last.meta.chosen as number[];
            const nodes = new Set<string>();
            edges.forEach(([u, v]) => {
                nodes.add(u);
                nodes.add(v);
            });
            expect(chosen.length).toBe(nodes.size - 1);
            const adj = new Map<string, string[]>([...nodes].map((n) => [n, []]));
            chosen.forEach((idx) => {
                const [u, v] = edges[idx]!;
                adj.get(u)!.push(v);
                adj.get(v)!.push(u);
            });
            const seen = new Set<string>([nodes.values().next().value!]);
            const stack = [...seen];
            while (stack.length) {
                const cur = stack.pop()!;
                for (const next of adj.get(cur)!) {
                    if (!seen.has(next)) {
                        seen.add(next);
                        stack.push(next);
                    }
                }
            }
            expect(seen.size).toBe(nodes.size);
        }
    });
});
