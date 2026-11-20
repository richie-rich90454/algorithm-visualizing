/**
 * dijkstra-radix-heap.test.ts - optimality vs reference Dijkstra, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./dijkstra-radix-heap";
import type { VisualFrame } from "@/types";

function reference(vertices: string[], edges: Array<[string, string, number]>, start: string, goal: string): number {
    const adj: Record<string, Array<[string, number]>> = Object.fromEntries(vertices.map((v) => [v, []]));
    for (const [u, v, w] of edges) {
        adj[u]?.push([v, w]);
        adj[v]?.push([u, w]);
    }
    const dist = new Map<string, number>(vertices.map((v) => [v, Infinity]));
    dist.set(start, 0);
    const done = new Set<string>();
    for (;;) {
        let u: string | undefined;
        let best = Infinity;
        for (const [v, d] of dist) if (!done.has(v) && d < best) [u, best] = [v, d];
        if (u === undefined) break;
        done.add(u);
        for (const [next, w] of adj[u] ?? []) dist.set(next, Math.min(dist.get(next) ?? Infinity, best + w));
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

function evaluate(vertices: string[], edges: Array<[string, string, number]>, start: string, goal: string) {
    const frames = [...mod.run({ vertices, edges, start, target: goal })];
    checkFrames(frames);
    const final = frames[frames.length - 1]?.meta as Record<string, unknown>;
    return { frames, cost: Number(final["cost"]), path: final["path"] as string[] };
}

describe("Dijkstra (Radix Heap)", () => {
    it("matches reference Dijkstra on the default input", () => {
        const input = mod.defaultInput as {
            vertices: string[];
            edges: Array<[string, string, number]>;
            start: string;
            target: string;
        };
        const result = evaluate(input.vertices, input.edges, input.start, input.target);
        expect(result.cost).toBeCloseTo(reference(input.vertices, input.edges, input.start, input.target), 10);
        expect(result.path[0]).toBe(input.start);
        expect(result.path[result.path.length - 1]).toBe(input.target);
    });

    it("matches reference Dijkstra on random integer-weighted graphs", () => {
        let seed = 53;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        const vertices = ["A", "B", "C", "D", "E", "F"];
        for (let trial = 0; trial < 25; trial += 1) {
            const edges: Array<[string, string, number]> = [];
            for (let i = 0; i < vertices.length; i += 1) {
                for (let j = i + 1; j < vertices.length; j += 1) {
                    if (rand() < 0.5) edges.push([vertices[i] ?? "A", vertices[j] ?? "B", 1 + Math.floor(rand() * 50)]);
                }
            }
            edges.push(["A", "B", 7], ["B", "C", 7], ["C", "D", 7], ["D", "E", 7], ["E", "F", 7]);
            const result = evaluate(vertices, edges, "A", "F");
            expect(result.cost).toBeCloseTo(reference(vertices, edges, "A", "F"), 10);
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
