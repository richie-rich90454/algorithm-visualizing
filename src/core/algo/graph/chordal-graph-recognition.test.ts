/**
 * chordal-graph-recognition.test.ts - Brute-force chordality cross-check,
 * perfect elimination ordering property, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./chordal-graph-recognition";
import type { VisualFrame } from "@/types";

type Adj = Record<string, string[]>;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
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

function bruteChordal(raw: Adj): boolean {
    const labels = [...new Set([...Object.keys(raw), ...Object.values(raw).flat().map(String)])].sort();
    const n = labels.length;
    if (n <= 1) return true;
    const idx = new Map(labels.map((label, i) => [label, i] as [string, number]));
    const adj = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
    for (const a of labels) {
        for (const b of raw[a] ?? []) {
            const ai = idx.get(a);
            const bi = idx.get(String(b));
            if (ai !== undefined && bi !== undefined && ai !== bi) {
                adj[ai]![bi] = true;
                adj[bi]![ai] = true;
            }
        }
    }
    const perm = Array.from({ length: n }, (_value, i) => i);
    const rank = Array<number>(n).fill(0);
    const passes = (): boolean => {
        for (let i = 0; i < n; i += 1) rank[perm[i]!] = i;
        for (let v = 0; v < n; v += 1) {
            const higher: number[] = [];
            for (let u = 0; u < n; u += 1) {
                if (adj[v]![u] && rank[u]! > rank[v]!) higher.push(u);
            }
            for (let a = 0; a < higher.length; a += 1) {
                for (let b = a + 1; b < higher.length; b += 1) {
                    if (!adj[higher[a]!]![higher[b]!]) return false;
                }
            }
        }
        return true;
    };
    const nextPermutation = (): boolean => {
        let i = n - 2;
        while (i >= 0 && perm[i]! >= perm[i + 1]!) i -= 1;
        if (i < 0) return false;
        let j = n - 1;
        while (perm[j]! <= perm[i]!) j -= 1;
        [perm[i], perm[j]] = [perm[j]!, perm[i]!];
        let lo = i + 1;
        let hi = n - 1;
        while (lo < hi) {
            [perm[lo], perm[hi]] = [perm[hi]!, perm[lo]!];
            lo += 1;
            hi -= 1;
        }
        return true;
    };
    do {
        if (passes()) return true;
    } while (nextPermutation());
    return false;
}

describe("Chordal Graph Recognition", () => {
    const graphs: Adj[] = [
        (mod.defaultInput as { graph: Adj }).graph,
        { A: ["B"], B: ["A", "C"], C: ["B"] },
        { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
        { A: ["B", "D"], B: ["A", "C"], C: ["B", "D"], D: ["A", "C"] },
        { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["A", "B", "C"] },
        { A: ["B", "E"], B: ["A", "C"], C: ["B", "D"], D: ["C", "E"], E: ["A", "D"] },
    ];

    it("matches brute-force chordality on small graphs", () => {
        for (const graph of graphs) {
            const frames = [...mod.run({ graph })];
            checkFrames(frames);
            const final = frames[frames.length - 1]!;
            expect(final.meta["recognized"]).toBe(true);
            expect(final.meta["chordal"]).toBe(bruteChordal(graph));
        }
    });

    it("reports an MCS order that covers every vertex exactly once", () => {
        for (const graph of graphs) {
            const frames = [...mod.run({ graph })];
            const order = frames[frames.length - 1]!.meta["mcsOrder"] as string[];
            expect(new Set(order).size).toBe(order.length);
            expect(order.slice().sort()).toEqual(Object.keys(graph).sort());
        }
    });

    it("handles an empty graph and terminates", () => {
        const empty = [...mod.run({ graph: {} })];
        checkFrames(empty);
        expect(empty[empty.length - 1]!.meta["chordal"]).toBe(true);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
