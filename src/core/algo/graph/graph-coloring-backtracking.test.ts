/**
 * graph-coloring-backtracking.test.ts - Brute-force chromatic-number check,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./graph-coloring-backtracking";
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

/** Independent reference: is the graph k-colorable? */
function colorable(adjacency: Adj, k: number): boolean {
    const vertices = Object.keys(adjacency);
    const assignment = new Map<string, number>();
    const search = (index: number): boolean => {
        if (index >= vertices.length) {
            return true;
        }
        const v = vertices[index];
        if (v === undefined) {
            return false;
        }
        for (let color = 0; color < k; color += 1) {
            let ok = true;
            for (const u of adjacency[v] ?? []) {
                if (assignment.get(String(u)) === color) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                assignment.set(v, color);
                if (search(index + 1)) {
                    return true;
                }
                assignment.delete(v);
            }
        }
        return false;
    };
    return search(0);
}

function bruteForceChromatic(adjacency: Adj): number {
    const vertices = Object.keys(adjacency);
    for (let k = 1; k <= vertices.length; k += 1) {
        if (colorable(adjacency, k)) {
            return k;
        }
    }
    return vertices.length;
}

describe("Exact Graph Coloring by Backtracking", () => {
    it("matches brute force on several graphs", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { adjacency: Adj }).adjacency,
            { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
            { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
            { A: ["B", "C", "D", "E"], B: ["A", "C", "D", "E"], C: ["A", "B", "D", "E"], D: ["A", "B", "C", "E"], E: ["A", "B", "C", "D"] },
        ];
        for (const adjacency of graphs) {
            const frames = [...mod.run({ adjacency })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["chromaticNumber"]).toBe(bruteForceChromatic(adjacency));
            const coloring = new Map(
                (meta?.["coloring"] as string[]).map((entry) => {
                    const [v, c] = entry.split(":");
                    return [v ?? "", Number(c)] as const;
                }),
            );
            expect(coloring.size).toBe(Object.keys(adjacency).length);
            for (const a of Object.keys(adjacency)) {
                for (const b of adjacency[a] ?? []) {
                    expect(coloring.get(a)).not.toBe(coloring.get(String(b)));
                }
            }
        }
    });

    it("uses one color for an edgeless graph", () => {
        const frames = [...mod.run({ adjacency: { A: [], B: [], C: [] } })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["chromaticNumber"]).toBe(1);
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
