/**
 * massively-parallel-transaction.test.ts - Decision versus the AND of all
 * votes, independent subtree aggregation, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { buildTree } from "./massively-parallel-transaction";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("tree");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function seeded(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807) % 0x7fffffff;
        return s / 0x7fffffff;
    };
}

/** Independently aggregate each subtree from the tree edges. */
function bruteAggregates(edges: Array<[number, number]>, shards: number, votes: boolean[]): Map<number, boolean> {
    const children = new Map<number, number[]>();
    for (const [parent, child] of edges) {
        if (!children.has(parent)) children.set(parent, []);
        (children.get(parent) as number[]).push(child);
    }
    const aggregate = (id: number): boolean => {
        if (id < shards) return votes[id] ?? true;
        return (children.get(id) ?? []).every(aggregate);
    };
    const result = new Map<number, boolean>();
    for (const [parent] of children) result.set(parent, aggregate(parent));
    return result;
}

describe("MassivelyParallelTransaction", () => {
    it("commits exactly when every shard votes yes, for random trees", () => {
        const rand = seeded(41);
        for (let trial = 0; trial < 60; trial += 1) {
            const shards = 2 + Math.floor(rand() * 7);
            const votes = Array.from({ length: shards }, () => rand() < 0.5);
            const frames = [...mod.run({ shards, votes })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            expect(final?.["decision"]).toBe(votes.every(Boolean) ? "commit" : "abort");
            const tree = buildTree(shards);
            expect(bruteAggregates(tree.edges, shards, votes).get(tree.root)).toBe(votes.every(Boolean));
        }
    });

    it("reports the same root aggregate as independent subtree AND", () => {
        const votes = [true, true, false, true, true, true, true];
        const frames = [...mod.run({ shards: 7, votes })];
        checkFrames(frames);
        const decisionFrame = frames.find((f) => f.meta["phase"] === "decision");
        expect(decisionFrame?.meta["decision"]).toBe("abort");
        const aggregates = ((decisionFrame?.meta["aggregates"] as string[]) ?? []).map((s) => {
            const [id, val] = s.split(":");
            return [Number(id), val === "Y"] as [number, boolean];
        });
        const brute = bruteAggregates(buildTree(7).edges, 7, votes);
        for (const [id, value] of aggregates) {
            if (brute.has(id)) expect(value).toBe(brute.get(id));
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
