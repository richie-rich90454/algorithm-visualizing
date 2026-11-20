/**
 * feedback-arc-set.test.ts - Acyclicity of the remainder, brute-force minimum
 * lower bound, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./feedback-arc-set";
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

function arcsOf(adjacency: Adj): Array<[string, string]> {
    const labels = Object.keys(adjacency).sort();
    const out: Array<[string, string]> = [];
    for (const a of labels) for (const b of adjacency[a] ?? []) if (labels.includes(b)) out.push([a, b]);
    return out;
}

function isAcyclic(labels: string[], arcs: Array<[string, string]>): boolean {
    const indegree = new Map(labels.map((v) => [v, 0]));
    for (const [, to] of arcs) indegree.set(to, (indegree.get(to) ?? 0) + 1);
    const queue = labels.filter((v) => indegree.get(v) === 0);
    let seen = 0;
    while (queue.length > 0) {
        const v = queue.shift() as string;
        seen += 1;
        for (const [from, to] of arcs) {
            if (from !== v) continue;
            const next = (indegree.get(to) ?? 0) - 1;
            indegree.set(to, next);
            if (next === 0) queue.push(to);
        }
    }
    return seen === labels.length;
}

function bruteMinimum(adjacency: Adj): number {
    const labels = Object.keys(adjacency).sort();
    const arcs = arcsOf(adjacency);
    for (let k = 0; k <= arcs.length; k += 1) {
        const keep = new Set<number>();
        const combine = (start: number, chosen: number): boolean => {
            if (chosen === k) {
                const remaining = arcs.filter((_, i) => !keep.has(i));
                return isAcyclic(labels, remaining);
            }
            for (let i = start; i < arcs.length; i += 1) {
                keep.add(i);
                if (combine(i + 1, chosen + 1)) return true;
                keep.delete(i);
            }
            return false;
        };
        if (combine(0, 0)) return k;
    }
    return arcs.length;
}

describe("Feedback Arc Set", () => {
    it("leaves an acyclic graph using at least the brute-force minimum deletions", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { adjacency: Adj }).adjacency,
            { A: ["B"], B: ["C"], C: ["A"] },
            { A: ["B", "C"], B: ["C"], C: ["A"] },
            { A: ["B"], B: ["C", "D"], C: ["A"], D: [] },
        ];
        for (const adjacency of graphs) {
            const frames = [...mod.run({ adjacency })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["acyclic"]).toBe(true);
            const labels = Object.keys(adjacency).sort();
            const original = arcsOf(adjacency);
            const removed = new Set((meta?.["removedArcs"] as string[]) ?? []);
            for (const arc of removed) expect(original.some(([a, b]) => `${a}>${b}` === arc)).toBe(true);
            const survivors = original.filter(([a, b]) => !removed.has(`${a}>${b}`));
            expect(isAcyclic(labels, survivors)).toBe(true);
            expect(Number(meta?.["removed"])).toBe(removed.size);
            expect(removed.size).toBeGreaterThanOrEqual(bruteMinimum(adjacency));
        }
    });

    it("terminates and handles an acyclic input", () => {
        const frames = [...mod.run({ adjacency: { A: ["B"], B: ["C"], C: [] } })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["removed"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
