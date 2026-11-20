/**
 * tree-decomposition.test.ts - Decomposition validity and brute-force width bound.
 */

import { describe, expect, it } from "vitest";
import mod from "./tree-decomposition";
import type { VisualFrame } from "@/types";

type Edge = [string, string];

/** Brute-force minimum treewidth over every elimination order. */
function bruteMinWidth(nodes: string[], edges: Edge[]): number {
    let best = Infinity;
    const perm: string[] = [];
    const used = new Set<string>();
    const visit = (): void => {
        if (perm.length === nodes.length) {
            const adj = new Map(nodes.map((v) => [v, new Set<string>()]));
            for (const [u, v] of edges) {
                adj.get(u)?.add(v);
                adj.get(v)?.add(u);
            }
            const remaining = new Set(nodes);
            let maxBag = 0;
            for (const v of perm) {
                const neighbors = [...(adj.get(v) ?? [])].filter((u) => remaining.has(u));
                maxBag = Math.max(maxBag, neighbors.length + 1);
                for (let i = 0; i < neighbors.length; i += 1) {
                    for (let j = i + 1; j < neighbors.length; j += 1) {
                        adj.get(neighbors[i]!)?.add(neighbors[j]!);
                        adj.get(neighbors[j]!)?.add(neighbors[i]!);
                    }
                }
                remaining.delete(v);
            }
            best = Math.min(best, maxBag - 1);
            return;
        }
        for (const v of nodes) {
            if (used.has(v)) {
                continue;
            }
            used.add(v);
            perm.push(v);
            visit();
            perm.pop();
            used.delete(v);
        }
    };
    visit();
    return best;
}

function parseBag(text: string): string[] {
    return text.replace(/[{}]/g, "").split(",").filter(Boolean);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("graph");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Min-fill tree decomposition", () => {
    it("covers every edge and keeps each vertex's bags connected", () => {
        const input = mod.defaultInput as { edges: Edge[] };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const bags = (final["bags"] as string[]).map(parseBag);
        const parent = new Map<number, number>();
        for (const edge of frames[frames.length - 1]!.edges) {
            const match = /^tree-(\d+)-(\d+)$/.exec(edge.id);
            if (match) {
                parent.set(Number(match[2]), Number(match[1]));
            }
        }
        for (const [u, v] of input.edges) {
            expect(bags.some((bag) => bag.includes(u) && bag.includes(v))).toBe(true);
        }
        for (const vertex of new Set(input.edges.flat())) {
            const containing = bags.map((bag, i) => (bag.includes(vertex) ? i : -1)).filter((i) => i >= 0);
            expect(containing.length).toBeGreaterThan(0);
            const tops = containing.map((bag) => {
                let cursor = bag;
                while (parent.has(cursor) && containing.includes(parent.get(cursor)!)) {
                    cursor = parent.get(cursor)!;
                }
                return cursor;
            });
            expect(new Set(tops).size).toBe(1);
        }
        const width = Math.max(...bags.map((bag) => bag.length)) - 1;
        expect(final["width"]).toBe(width);
    });

    it("never beats the brute-force optimum on small graphs", () => {
        const input = mod.defaultInput as { edges: Edge[] };
        const nodes = [...new Set(input.edges.flat())].slice(0, 7);
        const edges = input.edges.filter(([u, v]) => nodes.includes(u) && nodes.includes(v));
        const frames = [...mod.run({ edges })];
        const achieved = Number(frames[frames.length - 1]!.meta["width"]);
        expect(achieved).toBeGreaterThanOrEqual(bruteMinWidth(nodes, edges));
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
