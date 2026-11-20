import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./graphwave";

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
        frame.edges.forEach((edge) => {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        });
    });
}

/** Independent computation of a random-walk diffusion vector after t steps. */
function bruteDiffusion(adj: Record<string, string[]>, steps: number): number[] {
    const labels = [...new Set([...Object.keys(adj), ...Object.values(adj).flat()])].sort();
    const sets = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [u, vs] of Object.entries(adj)) {
        for (const v of vs) {
            if (u === v || !sets.has(u) || !sets.has(v)) continue;
            sets.get(u)?.add(v);
            sets.get(v)?.add(u);
        }
    }
    const p: number[][] = labels.map((u) => {
        const row = new Array<number>(labels.length).fill(0);
        const nb = [...(sets.get(u) ?? [])];
        if (nb.length === 0) row[labels.indexOf(u)] = 1;
        else for (const v of nb) row[labels.indexOf(v)] = 1 / nb.length;
        return row;
    });
    let vector = new Array<number>(labels.length).fill(0);
    vector[0] = 1;
    for (let t = 0; t < steps; t += 1) {
        const next = new Array<number>(labels.length).fill(0);
        for (let i = 0; i < labels.length; i += 1) {
            for (let j = 0; j < labels.length; j += 1) {
                next[j] = (next[j] as number) + (vector[i] as number) * (p[i] as number[])[j]!;
            }
        }
        vector = next;
    }
    return vector;
}

const graphs: Array<Record<string, string[]>> = [
    { A: ["B", "C"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["B", "C"], E: [] },
    { A: ["B"], B: ["A", "C"], C: ["B"], D: ["E"], E: ["D"] },
    { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
];

describe("GraphWave heat kernel diffusion", () => {
    it("matches an independent random-walk diffusion and conserves mass", () => {
        for (const graph of graphs) {
            for (const steps of [1, 3, 5]) {
                const fs = frames({ graph, steps });
                shapes(fs);
                const last = fs[fs.length - 1];
                const actual = last?.meta["distribution"] as number[];
                const expected = bruteDiffusion(graph, steps);
                expect(actual.length).toBe(expected.length);
                actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index] as number, 5));
                expect(actual.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
                actual.forEach((value) => expect(value).toBeGreaterThanOrEqual(0));
                expect(Number(last?.meta["mass"])).toBeCloseTo(1, 5);
            }
        }
    });

    it("keeps diffusion inside the source component and terminates", () => {
        const fs = frames({ graph: { A: ["B"], B: ["A"], C: ["D"], D: ["C"] }, steps: 4 });
        shapes(fs);
        const last = fs[fs.length - 1];
        expect(String(last?.meta["source"])).toBe("A");
        const distribution = last?.meta["distribution"] as number[];
        expect(distribution[2]).toBe(0);
        expect(distribution[3]).toBe(0);
    });
});
