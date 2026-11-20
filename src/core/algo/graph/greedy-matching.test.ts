/**
 * greedy-matching.test.ts - Matching validity and maximality property checks,
 * frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./greedy-matching";
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

function edgesOf(adjacency: Adj): Array<[string, string]> {
    const vertices = Object.keys(adjacency).sort();
    const seen = new Set<string>();
    const result: Array<[string, string]> = [];
    for (const a of vertices) {
        for (const raw of adjacency[a] ?? []) {
            const b = String(raw);
            if (!vertices.includes(b) || a === b) {
                continue;
            }
            const key = [a, b].sort().join("|");
            if (!seen.has(key)) {
                seen.add(key);
                result.push([a, b]);
            }
        }
    }
    return result;
}

/** Independent reference: maximum matching size by brute force. */
function maximumMatching(adjacency: Adj): number {
    const edges = edgesOf(adjacency);
    let best = 0;
    const search = (index: number, used: Set<string>, count: number): void => {
        if (index >= edges.length) {
            best = Math.max(best, count);
            return;
        }
        const edge = edges[index];
        if (edge) {
            if (!used.has(edge[0]) && !used.has(edge[1])) {
                const next = new Set(used);
                next.add(edge[0]);
                next.add(edge[1]);
                search(index + 1, next, count + 1);
            }
            search(index + 1, used, count);
        }
    };
    search(0, new Set<string>(), 0);
    return best;
}

describe("Greedy Maximal Matching", () => {
    it("produces a valid maximal matching within a factor of two of maximum", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { adjacency: Adj }).adjacency,
            { A: ["B", "C"], B: ["A", "D"], C: ["A", "D"], D: ["B", "C"] },
            { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C", "E"], E: ["D"] },
            { A: ["B", "C", "D"], B: ["A"], C: ["A"], D: ["A"] },
        ];
        for (const adjacency of graphs) {
            const frames = [...mod.run({ adjacency })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            const matched = new Set(meta?.["matchedVertices"] as string[]);
            const matching = (meta?.["matching"] as string[]).map((key) => key.replace(/^edge-/, "").split("-"));
            const used = new Set<string>();
            for (const edge of matching) {
                const a = edge[0];
                const b = edge[1];
                expect(a).toBeDefined();
                expect(b).toBeDefined();
                expect(used.has(a ?? "")).toBe(false);
                expect(used.has(b ?? "")).toBe(false);
                used.add(a ?? "");
                used.add(b ?? "");
            }
            for (const [a, b] of edgesOf(adjacency)) {
                expect(matched.has(a) || matched.has(b)).toBe(true);
            }
            expect(matching.length).toBeGreaterThanOrEqual(Math.floor(maximumMatching(adjacency) / 2));
            expect(meta?.["matchingSize"]).toBe(matching.length);
        }
    });

    it("returns an empty matching for an edgeless graph", () => {
        const frames = [...mod.run({ adjacency: { A: [], B: [] } })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["matchingSize"]).toBe(0);
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
