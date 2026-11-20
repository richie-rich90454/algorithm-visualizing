/**
 * ad-star.test.ts - optimality after a cost change, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./ad-star";
import type { VisualFrame } from "@/types";

type Graph = Record<string, Array<[string, number]>>;

function dijkstra(graph: Graph, start: string, goal: string): number {
    const dist = new Map<string, number>();
    for (const v of Object.keys(graph)) dist.set(v, Infinity);
    dist.set(start, 0);
    const done = new Set<string>();
    for (;;) {
        let u: string | undefined;
        let best = Infinity;
        for (const [v, d] of dist) if (!done.has(v) && d < best) [u, best] = [v, d];
        if (u === undefined) break;
        done.add(u);
        for (const [next, w] of graph[u] ?? []) {
            dist.set(next, Math.min(dist.get(next) ?? Infinity, best + w));
        }
    }
    return dist.get(goal) ?? Infinity;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    const seen = new Set<number>();
    frames.forEach((frame) => {
        expect(frame.layout).toBe("graph");
        expect(seen.has(frame.stepNumber)).toBe(false);
        seen.add(frame.stepNumber);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    frames.forEach((frame, i) => expect(frame.stepNumber).toBe(i));
}

describe("AD*", () => {
    it("returns an optimal route after the edge-cost change", () => {
        const input = mod.defaultInput as {
            graph: Graph;
            start: string;
            goal: string;
            change: [string, string, number];
        };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta as Record<string, unknown>;
        const changed = { ...input.graph };
        changed[input.change[0]] = (changed[input.change[0]] ?? []).map(([v, w]) =>
            v === input.change[1] ? [v, input.change[2]] : [v, w],
        );
        const optimum = dijkstra(changed, input.start, input.goal);
        expect(Number(final["cost"])).toBeCloseTo(optimum, 10);
        expect(Number(final["optimal"])).toBeCloseTo(optimum, 10);
        const path = final["path"] as string[];
        expect(path[0]).toBe(input.start);
        expect(path[path.length - 1]).toBe(input.goal);
    });

    it("never reports a suboptimal cost below the optimum", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        for (const frame of frames) {
            const cost = Number(frame.meta["cost"]);
            if (cost < 0) continue;
            expect(cost).toBeGreaterThanOrEqual(Number(frame.meta["optimal"]) - 1e-9);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
