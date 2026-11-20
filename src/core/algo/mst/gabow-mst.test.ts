/**
 * gabow-mst.test.ts - component-queue MST weight vs Kruskal, frame shape, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./gabow-mst";
import type { VisualFrame } from "@/types";

type Edge = [string, string, number];

function kruskal(vertices: string[], edges: Edge[]): number {
    const parent = new Map(vertices.map((v) => [v, v]));
    const find = (x: string): string => {
        let r = x;
        while (parent.get(r) !== r) r = parent.get(r) as string;
        return r;
    };
    let weight = 0;
    let count = 0;
    for (const [a, b, w] of [...edges].sort((x, y) => x[2] - y[2])) {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) continue;
        parent.set(ra, rb);
        weight += w;
        if (++count === vertices.length - 1) break;
    }
    return weight;
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

function evaluate(vertices: string[], edges: Edge[]) {
    const frames = [...mod.run({ vertices, edges })];
    checkFrames(frames);
    const final = frames[frames.length - 1]?.meta as Record<string, unknown>;
    return { frames, cost: Number(final["cost"]) };
}

describe("Gabow MST", () => {
    it("matches Kruskal on the default input", () => {
        const input = mod.defaultInput as { vertices: string[]; edges: Edge[] };
        const result = evaluate(input.vertices, input.edges);
        expect(result.cost).toBeCloseTo(kruskal(input.vertices, input.edges), 10);
    });

    it("matches Kruskal on random connected graphs", () => {
        let seed = 601;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        const vertices = ["A", "B", "C", "D", "E", "F"];
        for (let trial = 0; trial < 25; trial += 1) {
            const edges: Edge[] = [];
            for (let i = 0; i < vertices.length; i += 1) {
                for (let j = i + 1; j < vertices.length; j += 1) {
                    if (rand() < 0.5) edges.push([vertices[i] ?? "A", vertices[j] ?? "B", 1 + Math.floor(rand() * 20)]);
                }
            }
            for (let i = 0; i + 1 < vertices.length; i += 1) {
                edges.push([vertices[i] ?? "A", vertices[i + 1] ?? "B", 1 + Math.floor(rand() * 12)]);
            }
            const result = evaluate(vertices, edges);
            expect(result.cost).toBeCloseTo(kruskal(vertices, edges), 10);
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
