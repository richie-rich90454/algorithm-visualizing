/**
 * nested-dissection-ordering.test.ts - Permutation and separator-progress
 * properties checked by brute force, low-degree sanity, frame shape,
 * determinism, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./nested-dissection-ordering";
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

function splitList(value: string, outer: string, inner: string): string[][] {
    if (value === "") return [];
    return value.split(outer).map((part) => part.split(inner).filter(Boolean));
}

function isConnected(subset: string[], adj: Map<string, Set<string>>): boolean {
    if (subset.length === 0) return true;
    const set = new Set(subset);
    const seen = new Set<string>([subset[0] as string]);
    const stack = [subset[0] as string];
    while (stack.length > 0) {
        const u = stack.pop() as string;
        for (const v of adj.get(u) ?? []) {
            if (set.has(v) && !seen.has(v)) {
                seen.add(v);
                stack.push(v);
            }
        }
    }
    return seen.size === subset.length;
}

function verify(adjacency: Adj, frames: VisualFrame[]): void {
    const meta = frames[frames.length - 1]?.meta;
    const vertices = Object.keys(adjacency).sort();
    const order = String(meta?.["order"] ?? "").split(",").filter(Boolean);
    expect([...order].sort()).toEqual(vertices);
    const adj = new Map<string, Set<string>>(vertices.map((v) => [v, new Set<string>()]));
    for (const a of vertices) {
        for (const b of adjacency[a] ?? []) {
            if (!adjacency[b] || a === b) continue;
            adj.get(a)?.add(b);
            adj.get(b)?.add(a);
        }
    }
    const sizes = String(meta?.["subgraphSizes"] ?? "")
        .split(",")
        .filter(Boolean)
        .map(Number);
    const separators = splitList(String(meta?.["separatorSets"] ?? ""), "|", "+");
    const components = String(meta?.["componentSets"] ?? "")
        .split("|")
        .map((part) => part.split("/").map((c) => c.split("+").filter(Boolean)));
    expect(sizes.length).toBe(separators.length);
    expect(separators.length).toBe(components.length);
    for (let i = 0; i < separators.length; i += 1) {
        const sep = separators[i] as string[];
        const comps = components[i] as string[][];
        const sub = sizes[i] as number;
        expect(sep.length).toBeGreaterThan(0);
        const union = new Set<string>(sep);
        for (const comp of comps) {
            expect(comp.length).toBeGreaterThan(0);
            expect(comp.length).toBeLessThan(sub);
            expect(isConnected(comp, adj)).toBe(true);
            for (const v of comp) {
                expect(union.has(v)).toBe(false);
                union.add(v);
            }
        }
        expect(union.size).toBe(sub);
    }
}

describe("Nested Dissection Ordering", () => {
    it("produces a permutation and genuine separators on several graphs", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { adjacency: Adj }).adjacency,
            { A: ["B", "C"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["B", "C"] },
            { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C", "E"], E: ["D"] },
        ];
        for (const adjacency of graphs) {
            for (const leafSize of [1, 2]) {
                const frames = [...mod.run({ adjacency, leafSize })];
                checkFrames(frames);
                verify(adjacency, frames);
            }
        }
    });

    it("is deterministic and terminates on an empty graph", () => {
        const input = mod.defaultInput;
        expect([...mod.run(input)].at(-1)?.meta["order"]).toBe([...mod.run(input)].at(-1)?.meta["order"]);
        const frames = [...mod.run({ adjacency: {} })];
        checkFrames(frames);
        expect(frames[0]?.meta["orderSize"]).toBe(0);
        const generator = mod.run(input);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
