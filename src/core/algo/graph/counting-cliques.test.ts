/**
 * counting-cliques.test.ts - Brute-force clique counts, frame shape, and
 * termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./counting-cliques";
import type { VisualFrame } from "@/types";

type Adj = Record<string, string[]>;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
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

/** Independent reference: test every subset for pairwise adjacency. */
function bruteForce(adjacency: Adj): { total: number; bySize: Map<number, number> } {
    const vertices = Object.keys(adjacency).sort();
    let total = 0;
    const bySize = new Map<number, number>();
    for (let mask = 1; mask < 1 << vertices.length; mask += 1) {
        const subset = vertices.filter((_v, i) => (mask & (1 << i)) !== 0);
        let clique = true;
        for (const a of subset) {
            const neighbors = new Set((adjacency[a] ?? []).map(String));
            for (const b of subset) {
                if (a !== b && !neighbors.has(b)) {
                    clique = false;
                    break;
                }
            }
            if (!clique) {
                break;
            }
        }
        if (clique) {
            total += 1;
            bySize.set(subset.length, (bySize.get(subset.length) ?? 0) + 1);
        }
    }
    return { total, bySize };
}

function parseCounts(value: unknown): Map<number, number> {
    const result = new Map<number, number>();
    for (const entry of value as string[]) {
        const [size, count] = entry.split(":");
        result.set(Number(size), Number(count));
    }
    return result;
}

describe("Counting All Cliques", () => {
    it("matches brute force on several graphs", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { adjacency: Adj }).adjacency,
            { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
            { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
            { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["A", "B", "C"] },
        ];
        for (const adjacency of graphs) {
            const frames = [...mod.run({ adjacency })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const expected = bruteForce(adjacency);
            expect(meta?.["totalCliques"]).toBe(expected.total);
            const actual = parseCounts(meta?.["countsBySize"]);
            expect([...actual.entries()].sort((a, b) => a[0] - b[0])).toEqual(
                [...expected.bySize.entries()].sort((a, b) => a[0] - b[0]),
            );
            expect(meta?.["maximumSize"]).toBe(Math.max(...expected.bySize.keys()));
        }
    });

    it("counts a single isolated vertex", () => {
        const frames = [...mod.run({ adjacency: { A: [] } })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["totalCliques"]).toBe(1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
