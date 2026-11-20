/**
 * garbage-collection-incremental.test.ts - Reachability cross-check, write
 * barrier correctness, tri-color invariant, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { collect, reachable } from "./garbage-collection-incremental";
import type { VisualFrame } from "@/types";

/** Independent transitive-closure helper built by repeated relaxation. */
function bruteReachable(objects: number, edges: Array<[number, number]>, roots: number[]): Set<number> {
    const seen = new Set<number>(roots.filter((r) => r >= 0 && r < objects));
    let changed = true;
    while (changed) {
        changed = false;
        for (const [from, to] of edges) {
            if (seen.has(from) && !seen.has(to) && to >= 0 && to < objects) {
                seen.add(to);
                changed = true;
            }
        }
    }
    return seen;
}

function checkFrames(frames: VisualFrame[], objectCount: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(objectCount);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Incremental Tri-color Garbage Collection", () => {
    it("matches an independent reachability closure on random graphs", () => {
        let seed = 7;
        for (let trial = 0; trial < 200; trial += 1) {
            const objects = 2 + (trial % 12);
            const edges: Array<[number, number]> = [];
            for (let i = 0; i < trial % 20; i += 1) {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                const from = seed % objects;
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                edges.push([from, seed % objects]);
            }
            const roots = [trial % objects];
            expect([...reachable(objects, edges, roots)].sort((a, b) => a - b)).toEqual(
                [...bruteReachable(objects, edges, roots)].sort((a, b) => a - b),
            );
        }
    });

    it("marks exactly the reachable objects black when there are no writes", () => {
        const edges: Array<[number, number]> = [[0, 1], [1, 2], [3, 4], [0, 3]];
        const result = collect({ objects: 6, edges, roots: [0], writes: [], steps: 6 });
        const expected = bruteReachable(6, edges, [0]);
        result.colors.forEach((color, index) => {
            expect(color === 2).toBe(expected.has(index));
        });
        expect(result.barriers).toBe(0);
    });

    it("regrays a white object reached by a write from a black object", () => {
        const edges: Array<[number, number]> = [[0, 1]];
        const writes: Array<[number, number]> = [[0, 2], [0, 3]];
        const result = collect({ objects: 4, edges, roots: [0], writes, steps: 10 });
        expect(result.barriers).toBeGreaterThan(0);
        expect(result.colors[3]).toBe(2);
        const expected = bruteReachable(4, [...edges, ...writes], [0]);
        result.colors.forEach((color, index) => {
            expect(color === 2).toBe(expected.has(index));
        });
    });

    it("keeps every reachable object black after many random writes", () => {
        const objects = 8;
        const edges: Array<[number, number]> = [[0, 1], [1, 2], [2, 3]];
        const writes: Array<[number, number]> = [[3, 4], [4, 5], [5, 6], [6, 7]];
        const result = collect({ objects, edges, roots: [0], writes, steps: 30 });
        const expected = bruteReachable(objects, [...edges, ...writes], [0]);
        for (const index of expected) {
            expect(result.colors[index]).toBe(2);
        }
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 6);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
