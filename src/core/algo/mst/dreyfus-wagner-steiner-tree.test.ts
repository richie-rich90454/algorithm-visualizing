/**
 * dreyfus-wagner-steiner-tree.test.ts - exact cost vs brute-force edge subsets.
 */
import { describe, expect, it } from "vitest";
import mod from "./dreyfus-wagner-steiner-tree";
import type { VisualFrame } from "@/types";

type Edge = [string, string, number];

function bruteForce(vertices: string[], edges: Edge[], terminals: string[]): number {
    let best = Infinity;
    for (let mask = 0; mask < 1 << edges.length; mask += 1) {
        const parent = new Map(vertices.map((v) => [v, v]));
        const find = (x: string): string => {
            let r = x;
            while (parent.get(r) !== r) r = parent.get(r) as string;
            return r;
        };
        let weight = 0;
        for (let i = 0; i < edges.length; i += 1) {
            if (!(mask & (1 << i))) continue;
            const [a, b, w] = edges[i] as Edge;
            const ra = find(a);
            const rb = find(b);
            if (ra !== rb) parent.set(ra, rb);
            weight += w;
        }
        const roots = terminals.map(find);
        if (roots.every((r) => r === roots[0])) best = Math.min(best, weight);
    }
    return best;
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

function evaluate(vertices: string[], edges: Edge[], terminals: string[]) {
    const frames = [...mod.run({ vertices, edges, terminals })];
    checkFrames(frames);
    const final = frames[frames.length - 1]?.meta as Record<string, unknown>;
    return { frames, cost: Number(final["cost"]) };
}

describe("Dreyfus-Wagner Steiner Tree", () => {
    it("matches brute force on the default input", () => {
        const input = mod.defaultInput as { vertices: string[]; edges: Edge[]; terminals: string[] };
        const result = evaluate(input.vertices, input.edges, input.terminals);
        expect(result.cost).toBeCloseTo(bruteForce(input.vertices, input.edges, input.terminals), 10);
    });

    it("matches brute force on random small graphs", () => {
        let seed = 211;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        const vertices = ["A", "B", "C", "D", "E"];
        for (let trial = 0; trial < 12; trial += 1) {
            const edges: Edge[] = [];
            for (let i = 0; i < vertices.length; i += 1) {
                for (let j = i + 1; j < vertices.length; j += 1) {
                    if (rand() < 0.45) edges.push([vertices[i] ?? "A", vertices[j] ?? "B", 1 + Math.floor(rand() * 10)]);
                }
            }
            // Guarantee connectivity with a spanning chain.
            for (let i = 0; i + 1 < vertices.length; i += 1) {
                edges.push([vertices[i] ?? "A", vertices[i + 1] ?? "B", 2 + Math.floor(rand() * 6)]);
            }
            const terminals = [vertices[0] ?? "A", vertices[2] ?? "C", vertices[4] ?? "E"];
            const result = evaluate(vertices, edges, terminals);
            expect(result.cost).toBeCloseTo(bruteForce(vertices, edges, terminals), 10);
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
