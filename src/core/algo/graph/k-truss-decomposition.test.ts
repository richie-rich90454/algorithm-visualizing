/**
 * k-truss-decomposition.test.ts - Independent peeling check, frame shape, and
 * termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./k-truss-decomposition";
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

function edgeSet(adjacency: Adj): Set<string> {
    const vertices = Object.keys(adjacency).sort();
    const result = new Set<string>();
    for (const a of vertices) {
        for (const raw of adjacency[a] ?? []) {
            const b = String(raw);
            if (!vertices.includes(b) || a === b) {
                continue;
            }
            result.add([a, b].sort().join("|"));
        }
    }
    return result;
}

/** Independent reference: recompute all supports from scratch each round. */
function bruteForceTruss(adjacency: Adj, k: number): Set<string> {
    const alive = edgeSet(adjacency);
    const support = (edge: string): number => {
        const [a, b] = edge.split("|");
        const na = new Set(adjacency[a ?? ""]?.map(String) ?? []);
        const nb = new Set(adjacency[b ?? ""]?.map(String) ?? []);
        let count = 0;
        for (const v of na) {
            if (nb.has(v)) {
                count += 1;
            }
        }
        return count;
    };
    let changed = true;
    while (changed) {
        changed = false;
        for (const edge of [...alive]) {
            if (support(edge) < k - 2) {
                alive.delete(edge);
                changed = true;
            }
        }
    }
    return alive;
}

function survivorEdges(frame: VisualFrame | undefined): Set<string> {
    const result = new Set<string>();
    for (const edge of frame?.edges ?? []) {
        if (edge.state === "sorted") {
            result.add(edge.id.replace("edge-", "").replace("-", "|"));
        }
    }
    return result;
}

describe("K-Truss Decomposition", () => {
    it("matches an independent peeling reference", () => {
        const graphs: Array<{ adjacency: Adj; k: number }> = [
            { adjacency: (mod.defaultInput as { adjacency: Adj }).adjacency, k: 3 },
            { adjacency: { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"], D: ["A"] }, k: 3 },
            { adjacency: { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["A", "B", "C"] }, k: 4 },
        ];
        for (const { adjacency, k } of graphs) {
            const frames = [...mod.run({ adjacency, k })];
            checkFrames(frames);
            const final = frames[frames.length - 1];
            expect(final?.meta["remainingEdges"]).toBe(bruteForceTruss(adjacency, k).size);
            expect(survivorEdges(final)).toEqual(bruteForceTruss(adjacency, k));
        }
    });

    it("keeps all edges when k is two", () => {
        const adjacency: Adj = { A: ["B"], B: ["A", "C"], C: ["B"] };
        const frames = [...mod.run({ adjacency, k: 2 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["remainingEdges"]).toBe(2);
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
