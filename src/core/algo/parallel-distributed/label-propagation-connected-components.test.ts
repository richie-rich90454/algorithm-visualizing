/**
 * label-propagation-connected-components.test.ts - Component-minimum checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateLabelPropagation } from "./label-propagation-connected-components";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], nodes: number, edgeCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodes);
        expect(frame.edges.length).toBe(edgeCount);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent component label via breadth-first search. */
function bfsLabels(n: number, edges: number[][]): number[] {
    const adj = Array.from({ length: n }, () => [] as number[]);
    for (const [u, v] of edges) {
        if (u === undefined || v === undefined) continue;
        adj[u]!.push(v);
        adj[v]!.push(u);
    }
    const labels = Array<number>(n).fill(-1);
    for (let start = 0; start < n; start += 1) {
        if (labels[start] !== -1) continue;
        const component: number[] = [];
        const queue = [start];
        labels[start] = start;
        while (queue.length > 0) {
            const cur = queue.shift()!;
            component.push(cur);
            for (const next of adj[cur]!) {
                if (labels[next] === -1) {
                    labels[next] = start;
                    queue.push(next);
                }
            }
        }
    }
    return labels;
}

describe("Label Propagation Connected Components", () => {
    it("finds the minimum id of each component on random graphs", () => {
        let seed = 12345;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed;
        };
        for (let trial = 0; trial < 60; trial += 1) {
            const n = 2 + (rand() % 9);
            const edges: number[][] = [];
            for (let u = 0; u < n; u += 1) {
                for (let v = u + 1; v < n; v += 1) {
                    if (rand() % 3 === 0) edges.push([u, v]);
                }
            }
            const data = simulateLabelPropagation(n, edges);
            const expected = bfsLabels(n, edges);
            expect(data.finalLabels).toEqual(expected);
            const frames = [...mod.run({ nodes: n, edges })];
            checkFrames(frames, n, edges.length);
            expect(frames[frames.length - 1]?.meta["converged"]).toBe(true);
            expect(frames[frames.length - 1]?.meta["labels"]).toEqual(expected);
        }
    });

    it("keeps disconnected vertices on their own labels", () => {
        const edges: number[][] = [];
        const data = simulateLabelPropagation(5, edges);
        expect(data.finalLabels).toEqual([0, 1, 2, 3, 4]);
        expect(data.components.length).toBe(5);
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
