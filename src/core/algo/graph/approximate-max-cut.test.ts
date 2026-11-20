/**
 * approximate-max-cut.test.ts - Cut accounting, the half-the-edges bound,
 * brute-force optimum ceiling, determinism, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./approximate-max-cut";
import type { VisualFrame } from "@/types";

type Adj = Record<string, string[]>;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function edgesOf(adjacency: Adj): Array<[string, string]> {
    const vertices = Object.keys(adjacency).sort();
    const seen = new Set<string>();
    const out: Array<[string, string]> = [];
    for (const a of vertices) {
        for (const b of adjacency[a] ?? []) {
            if (!adjacency[b] || a === b) continue;
            const key = [a, b].sort().join("|");
            if (seen.has(key)) continue;
            seen.add(key);
            out.push([a, b]);
        }
    }
    return out;
}

function bruteMaxCut(adjacency: Adj): number {
    const vertices = Object.keys(adjacency).sort();
    const edges = edgesOf(adjacency);
    let best = 0;
    for (let mask = 0; mask < 1 << vertices.length; mask += 1) {
        const side = (v: string): number => (mask >> vertices.indexOf(v)) & 1;
        let cut = 0;
        for (const [a, b] of edges) if (side(a) !== side(b)) cut += 1;
        best = Math.max(best, cut);
    }
    return best;
}

describe("Approximate Max-Cut (Local Search)", () => {
    it("finds a valid cut no worse than the start and at least half of all edges", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { adjacency: Adj }).adjacency,
            { A: ["B", "C"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["B", "C"] },
            { A: ["B", "C", "D", "E"], B: ["A"], C: ["A"], D: ["A"], E: ["A"] },
        ];
        for (const adjacency of graphs) {
            for (const seed of [1, 5, 9]) {
                const frames = [...mod.run({ adjacency, seed })];
                checkFrames(frames);
                const meta = frames[frames.length - 1]?.meta;
                const a = new Set(String(meta?.["partitionA"] ?? "").split(",").filter(Boolean));
                const realCut = edgesOf(adjacency).filter(([x, y]) => a.has(x) !== a.has(y)).length;
                expect(realCut).toBe(Number(meta?.["cutSize"]));
                expect(realCut).toBeGreaterThanOrEqual(Number(meta?.["initialCut"]));
                expect(realCut).toBeLessThanOrEqual(bruteMaxCut(adjacency));
                expect(meta?.["localOptimum"]).toBe(true);
                expect(realCut * 2).toBeGreaterThanOrEqual(edgesOf(adjacency).length);
            }
        }
    });

    it("is deterministic for a fixed seed", () => {
        const input = mod.defaultInput;
        expect([...mod.run(input)].at(-1)?.meta["cutSize"]).toBe([...mod.run(input)].at(-1)?.meta["cutSize"]);
    });

    it("terminates on an empty graph", () => {
        const frames = [...mod.run({ adjacency: {} })];
        checkFrames(frames);
        expect(frames[0]?.meta["cutSize"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
