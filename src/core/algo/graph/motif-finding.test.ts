import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./motif-finding";

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

function bruteCensus(adj: Record<string, string[]>): number[] {
    const labels = [...new Set([...Object.keys(adj), ...Object.values(adj).flat()])];
    const sets = new Map(labels.map((v) => [v, new Set<string>()]));
    for (const [u, vs] of Object.entries(adj)) {
        for (const v of vs) {
            if (u === v || !sets.has(u) || !sets.has(v)) continue;
            sets.get(u)?.add(v);
            sets.get(v)?.add(u);
        }
    }
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < labels.length; i += 1) {
        for (let j = i + 1; j < labels.length; j += 1) {
            for (let k = j + 1; k < labels.length; k += 1) {
                const trio = [labels[i] as string, labels[j] as string, labels[k] as string];
                let present = 0;
                for (let x = 0; x < 3; x += 1) {
                    for (let y = x + 1; y < 3; y += 1) {
                        if (sets.get(trio[x] as string)?.has(trio[y] as string)) present += 1;
                    }
                }
                counts[present] = (counts[present] as number) + 1;
            }
        }
    }
    return counts;
}

const graphs: Array<Record<string, string[]>> = [
    { A: ["B", "C", "D"], B: ["A", "C"], C: ["A", "B", "D"], D: ["A", "C"], E: [] },
    { A: ["B", "C", "D", "E"], B: ["A"], C: ["A"], D: ["A"], E: ["A"] },
    { A: ["B"], B: ["A", "C"], C: ["B"], D: [] },
    { A: [], B: [], C: [] },
];

describe("Three-vertex motif census", () => {
    it("matches a brute-force triad census and partitions all triples", () => {
        for (const graph of graphs) {
            const fs = frames({ graph });
            shapes(fs);
            const last = fs[fs.length - 1];
            const expected = bruteCensus(graph);
            expect(last?.meta["empty"]).toBe(expected[0]);
            expect(last?.meta["single"]).toBe(expected[1]);
            expect(last?.meta["wedge"]).toBe(expected[2]);
            expect(last?.meta["triangle"]).toBe(expected[3]);
            const total = expected.reduce((a, b) => a + b, 0);
            expect(last?.meta["triples"]).toBe(total);
            const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])].length;
            expect(total).toBe((labels * (labels - 1) * (labels - 2)) / 6);
        }
    });

    it("terminates on the default input", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        expect(Number(fs[fs.length - 1]?.meta["triples"])).toBe(10);
    });
});
