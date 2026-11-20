/**
 * loop-erased-random-walk.test.ts - Simple-path properties against exhaustive
 * path enumeration, determinism, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./loop-erased-random-walk";
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

function allSimplePaths(adjacency: Adj, start: string, target: string): string[][] {
    const paths: string[][] = [];
    const visit = (v: string, path: string[]): void => {
        if (v === target) {
            paths.push([...path]);
            return;
        }
        for (const next of adjacency[v] ?? []) {
            if (path.includes(next)) continue;
            visit(next, [...path, next]);
        }
    };
    visit(start, [start]);
    return paths;
}

describe("Loop-Erased Random Walk", () => {
    it("always produces a simple path that exists in the graph", () => {
        for (const seed of [1, 2, 7, 19, 42, 100]) {
            const input = { ...(mod.defaultInput as object), seed };
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["reached"]).toBe(true);
            const trace = String(meta?.["trace"] ?? "").split(",");
            expect(trace[0]).toBe("A");
            expect(trace[trace.length - 1]).toBe("F");
            expect(new Set(trace).size).toBe(trace.length);
            const adjacency = (mod.defaultInput as { adjacency: Adj }).adjacency;
            for (let i = 0; i + 1 < trace.length; i += 1) {
                expect(adjacency[trace[i] as string]).toContain(trace[i + 1]);
            }
            const reference = allSimplePaths(adjacency, "A", "F").map((p) => p.join(","));
            expect(reference).toContain(trace.join(","));
        }
    });

    it("is deterministic for a fixed seed", () => {
        const input = mod.defaultInput;
        const first = [...mod.run(input)].at(-1)?.meta["trace"];
        const second = [...mod.run(input)].at(-1)?.meta["trace"];
        expect(first).toBe(second);
    });

    it("terminates on an empty graph and on the default input", () => {
        const empty = [...mod.run({ adjacency: {}, start: "A", target: "B" })];
        checkFrames(empty);
        expect(empty[0]?.meta["reached"]).toBe(false);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
