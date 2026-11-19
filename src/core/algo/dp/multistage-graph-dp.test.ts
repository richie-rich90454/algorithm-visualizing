/**
 * multistage-graph-dp.test.ts - Brute force path enumeration, frames, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./multistage-graph-dp";
import type { VisualFrame } from "@/types";

type Edge = [number, number, number];

/** Exhaustively walk every source-to-sink path and return the cheapest cost. */
function bruteShortest(edges: Edge[], source: number, sink: number): number {
    const adjacency = new Map<number, Array<{ to: number; weight: number }>>();
    for (const [u, v, w] of edges) {
        if (!adjacency.has(u)) adjacency.set(u, []);
        adjacency.get(u)?.push({ to: v, weight: w });
    }
    let best = Number.POSITIVE_INFINITY;
    const walk = (u: number, spent: number, seen: Set<number>) => {
        if (seen.has(u)) return;
        if (u === sink) {
            best = Math.min(best, spent);
            return;
        }
        const nextSeen = new Set(seen);
        nextSeen.add(u);
        for (const { to, weight } of adjacency.get(u) ?? []) walk(to, spent + weight, nextSeen);
    };
    walk(source, 0, new Set());
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
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

describe("Multistage Graph DP", () => {
    it("matches exhaustive path enumeration", () => {
        const input = mod.defaultInput as { edges: Edge[]; source: number; sink: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(bruteShortest(input.edges, input.source, input.sink));
        const path = frames[frames.length - 1]?.meta["path"] as number[];
        let sum = 0;
        for (let i = 0; i + 1 < path.length; i += 1) {
            const found = input.edges.find((e) => e[0] === path[i] && e[1] === path[i + 1]);
            expect(found).toBeDefined();
            sum += found?.[2] ?? 0;
        }
        expect(sum).toBe(Number(frames[frames.length - 1]?.meta["answer"]));
    });

    it("handles a small layered graph correctly", () => {
        const edges: Edge[] = [[0, 1, 1], [0, 2, 2], [1, 3, 2], [2, 3, 1]];
        const frames = [...mod.run({ edges, source: 0, sink: 3 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["answer"]).toBe(3);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
