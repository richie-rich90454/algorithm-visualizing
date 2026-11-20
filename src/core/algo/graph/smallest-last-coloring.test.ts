import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./smallest-last-coloring";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        frame.entities.forEach((entity) => expect(Number.isFinite(entity.x)).toBe(true));
        frame.edges.forEach((edge) => {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        });
    });
}

function symmetrize(adj: Record<string, string[]>): Map<string, Set<string>> {
    const labels = [...new Set([...Object.keys(adj), ...Object.values(adj).flat()])];
    const sets = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [u, vs] of Object.entries(adj)) {
        for (const v of vs) {
            if (u === v || !sets.has(u) || !sets.has(v)) continue;
            sets.get(u)?.add(v);
            sets.get(v)?.add(u);
        }
    }
    return sets;
}

/** Independent smallest-last peeling: repeatedly take a minimum-degree vertex. */
function peel(adj: Record<string, string[]>): string[] {
    const sets = symmetrize(adj);
    const remaining = new Set(sets.keys());
    const order: string[] = [];
    while (remaining.size > 0) {
        let pick = "";
        let best = Infinity;
        for (const v of [...remaining].sort()) {
            let degree = 0;
            for (const nb of sets.get(v) ?? []) if (remaining.has(nb)) degree += 1;
            if (degree < best) {
                best = degree;
                pick = v;
            }
        }
        remaining.delete(pick);
        order.push(pick);
    }
    return order;
}

const graphs: Array<Record<string, string[]>> = [
    {
        A: ["B", "C", "D"],
        B: ["A", "C", "E"],
        C: ["A", "B", "E"],
        D: ["A"],
        E: ["B", "C"],
    },
    { A: ["B", "C"], B: ["A"], C: ["A"], D: [] },
    { A: ["B", "C", "D", "E"], B: ["A"], C: ["A"], D: ["A"], E: ["A"] },
    { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C", "A"] },
    { A: [] },
];

describe("Smallest-last ordering coloring", () => {
    it("produces a proper coloring and the true smallest-last order", () => {
        for (const graph of graphs) {
            const fs = frames({ graph });
            shapes(fs);
            const last = fs[fs.length - 1];
            const coloring = last?.meta["coloring"] as Record<string, number>;
            const sets = symmetrize(graph);
            expect(coloring).toBeDefined();
            for (const [u, neighbors] of sets) {
                for (const v of neighbors) {
                    expect(coloring[u]).not.toBe(coloring[v]);
                }
                expect(coloring[u] as number).toBeLessThanOrEqual((sets.get(u)?.size ?? 0) + 1);
            }
            expect(String(last?.meta["order"])).toBe([...peel(graph)].reverse().join(","));
        }
    });

    it("terminates on the default input and colors every vertex", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        const coloring = last?.meta["coloring"] as Record<string, number>;
        expect(Object.keys(coloring).length).toBe(5);
        expect(Number(last?.meta["colors"])).toBeGreaterThan(0);
    });
});
