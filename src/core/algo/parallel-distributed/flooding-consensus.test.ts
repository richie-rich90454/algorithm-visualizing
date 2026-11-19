/**
 * flooding-consensus.test.ts - BFS reference, round and reachability checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./flooding-consensus";
import type { VisualFrame } from "@/types";

type Input = { n: number; edges: Array<[number, number]>; source: number; value: string | number; maxRounds: number };

function bfs(input: Input): Map<number, number> {
    const adjacency: number[][] = Array.from({ length: input.n }, () => []);
    for (const [a, b] of input.edges) {
        adjacency[a]?.push(b);
        adjacency[b]?.push(a);
    }
    const dist = new Map<number, number>([[input.source, 0]]);
    const queue = [input.source];
    while (queue.length > 0) {
        const node = queue.shift()!;
        for (const next of adjacency[node] ?? []) {
            if (!dist.has(next)) {
                dist.set(next, dist.get(node)! + 1);
                queue.push(next);
            }
        }
    }
    return dist;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.every((edge) => edge.sourceId.startsWith("node-") && edge.targetId.startsWith("node-"))).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("FloodingConsensus", () => {
    it("reaches all nodes in the source component within the eccentricity", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)] as VisualFrame[];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const dist = bfs(input);
        expect(final?.["complete"]).toBe(true);
        expect(final?.["rounds"]).toBe(Math.max(...dist.values()));
        expect(final?.["knownCount"]).toBe(input.n);
        expect(final?.["known"]).toEqual([0, 1, 2, 3, 4, 5]);
        expect(frames.length).toBe(5);
    });

    it("does not cross component boundaries", () => {
        const input: Input = {
            n: 6,
            edges: [[0, 1], [1, 2]],
            source: 0,
            value: "x",
            maxRounds: 10,
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["known"]).toEqual([0, 1, 2]);
        expect(final?.["knownCount"]).toBe(3);
        expect(final?.["complete"]).toBe(true);
        expect(final?.["rounds"]).toBe(2);
    });

    it("respects the round budget", () => {
        const input = { ...(mod.defaultInput as Input), maxRounds: 1 };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["rounds"]).toBe(1);
        expect(final?.["complete"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(5);
        expect(generator.next().done).toBe(true);
    });
});
