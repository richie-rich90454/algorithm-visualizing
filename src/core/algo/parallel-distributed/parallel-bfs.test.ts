/**
 * parallel-bfs.test.ts - Cross-check against sequential BFS, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./parallel-bfs";
import type { VisualFrame } from "@/types";

/** Standard queue-based BFS used as an independent reference. */
function sequentialBfs(adjacency: number[][], source: number): number[] {
    const distances: number[] = Array.from({ length: adjacency.length }, () => -1);
    distances[source] = 0;
    const queue: number[] = [source];
    for (let head = 0; head < queue.length; head += 1) {
        const vertex = queue[head]!;
        for (const neighbor of adjacency[vertex] ?? []) {
            if (neighbor >= 0 && neighbor < adjacency.length && distances[neighbor] === -1) {
                distances[neighbor] = distances[vertex]! + 1;
                queue.push(neighbor);
            }
        }
    }
    return distances;
}

function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 22695477) + 1) >>> 0;
        return state / 0x100000000;
    };
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Parallel BFS", () => {
    it("produces the same distances as sequential BFS on random graphs", () => {
        const random = makeRandom(43);
        for (let trial = 0; trial < 200; trial += 1) {
            const count = 3 + Math.floor(random() * 6);
            const density = random();
            const adjacency: number[][] = Array.from({ length: count }, () => []);
            for (let from = 0; from < count; from += 1) {
                for (let to = 0; to < count; to += 1) {
                    if (from !== to && random() < density) {
                        adjacency[from]!.push(to);
                    }
                }
            }
            const source = Math.floor(random() * count);
            const frames = [...mod.run({ adjacency, source })];
            checkFrames(frames, count);
            const finalDistances = frames[frames.length - 1]!.meta["distances"] as number[];
            expect(finalDistances).toEqual(sequentialBfs(adjacency, source));
        }
    });

    it("handles an unreachable component", () => {
        const adjacency = [
            [1],
            [0],
            [3],
            [2],
        ];
        const frames = [...mod.run({ adjacency, source: 0 })];
        expect(frames[frames.length - 1]!.meta["distances"]).toEqual([0, 1, -1, -1]);
        expect(frames[frames.length - 1]!.meta["visited"]).toBe(2);
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
