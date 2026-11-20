/**
 * ray-tracing-gc.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./ray-tracing-gc";
import type { VisualFrame } from "@/types";

interface Input {
    objects: number[][];
    roots: number[];
}

/** Reference reachability by an explicit stack-based DFS. */
function reachability(objects: number[][], roots: number[]): Set<number> {
    const seen = new Set<number>();
    const stack = roots.filter((r) => r >= 0 && r < objects.length);
    while (stack.length > 0) {
        const node = stack.pop()!;
        if (seen.has(node)) continue;
        seen.add(node);
        for (const child of objects[node] ?? []) stack.push(child);
    }
    return seen;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
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

describe("Ray Tracing Garbage Collection", () => {
    it("collects exactly the unreachable objects in the default graph", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const live = reachability(input.objects, input.roots);
        const expected = [...live].sort((a, b) => a - b);
        expect(final?.["survivors"]).toEqual(expected);
        expect(final?.["correct"]).toBe(1);
        expect(final?.["collected"]).toEqual([6]);
    });

    it("matches DFS reachability across many random directed acyclic graphs", () => {
        let seed = 987654;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const n = 3 + (rand() % 9);
            const objects: number[][] = [];
            for (let i = 0; i < n; i += 1) {
                const list: number[] = [];
                for (let j = i + 1; j < n; j += 1) {
                    if (rand() % 4 === 0) list.push(j);
                }
                objects.push(list);
            }
            const roots: number[] = [];
            for (let i = 0; i < n; i += 1) {
                if (rand() % 3 === 0) roots.push(i);
            }
            const frames = [...mod.run({ objects, roots })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = [...reachability(objects, roots)].sort((a, b) => a - b);
            expect(final?.["survivors"]).toEqual(expected);
            expect(final?.["correct"]).toBe(1);
            const collected = final?.["collected"] as number[];
            expect(collected.length + expected.length).toBe(n);
        }
    });

    it("documents the cycle limitation instead of claiming success", () => {
        const frames = [...mod.run({ objects: [[1], [0]], roots: [] })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["collected"]).toEqual([]);
        expect(final?.["correct"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
