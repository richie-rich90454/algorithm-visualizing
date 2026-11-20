/**
 * cheriton-tarjan-mst.test.ts - MST weight vs Kruskal, tree structure, frame checks, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./cheriton-tarjan-mst";
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
    const lines = mod.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.layout).toBe("graph");
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lines);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const edge of frame.edges) {
            expect(edge.sourceId).toBeTruthy();
            expect(edge.targetId).toBeTruthy();
        }
        expect(frame.meta).toBeDefined();
    });
}

function evaluate(vertices: string[], edges: Edge[]) {
    const frames = [...mod.run({ vertices, edges })];
    checkFrames(frames);
    const final = frames[frames.length - 1]?.meta as Record<string, unknown>;
    return { frames, cost: Number(final["cost"]), optimal: Number(final["optimal"]) };
}

/** Recover the high-weight edges chosen in the final frame and check it is a spanning tree. */
function spanningTreeWeight(vertices: string[], edges: Edge[], final: VisualFrame): { weight: number; valid: boolean } {
    if (vertices.length === 0) return { weight: 0, valid: true };
    const chosen: Edge[] = [];
    final.edges.forEach((edge) => {
        if (edge.state !== "path") return;
        const index = Number(edge.id.slice(5));
        const tuple = edges[index];
        if (tuple) chosen.push(tuple);
    });
    if (chosen.length !== vertices.length - 1) return { weight: -1, valid: false };
    const parent = new Map(vertices.map((v) => [v, v]));
    const find = (x: string): string => {
        let r = x;
        while (parent.get(r) !== r) r = parent.get(r) as string;
        return r;
    };
    let weight = 0;
    for (const [a, b, w] of chosen) {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) return { weight: -1, valid: false };
        parent.set(ra, rb);
        weight += w;
    }
    const root = find(vertices[0]!);
    const connected = vertices.every((v) => find(v) === root);
    return { weight, valid: connected };
}

describe("Cheriton-Tarjan MST", () => {
    it("matches Kruskal on the default input and emits a valid spanning tree", () => {
        const input = mod.defaultInput as { vertices: string[]; edges: Edge[] };
        const result = evaluate(input.vertices, input.edges);
        expect(result.cost).toBeCloseTo(kruskal(input.vertices, input.edges), 10);
        expect(result.optimal).toBeCloseTo(result.cost, 10);
        const tree = spanningTreeWeight(input.vertices, input.edges, result.frames[result.frames.length - 1]!);
        expect(tree.valid).toBe(true);
        expect(tree.weight).toBeCloseTo(result.cost, 10);
    });

    it("matches Kruskal on random connected graphs", () => {
        let seed = 991;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        const vertices = ["A", "B", "C", "D", "E", "F"];
        for (let trial = 0; trial < 25; trial += 1) {
            const edges: Edge[] = [];
            for (let i = 0; i < vertices.length; i += 1) {
                for (let j = i + 1; j < vertices.length; j += 1) {
                    if (rand() < 0.5) edges.push([vertices[i]!, vertices[j]!, 1 + Math.floor(rand() * 20)]);
                }
            }
            for (let i = 0; i + 1 < vertices.length; i += 1) {
                edges.push([vertices[i]!, vertices[i + 1]!, 1 + Math.floor(rand() * 12)]);
            }
            const result = evaluate(vertices, edges);
            expect(result.cost).toBeCloseTo(kruskal(vertices, edges), 10);
        }
    });

    it("handles a single vertex and empty input", () => {
        const one = [...mod.run({ vertices: ["A"], edges: [] })];
        expect(one[one.length - 1]!.meta["cost"]).toBe(0);
        const empty = [...mod.run({ vertices: [], edges: [] })];
        expect(empty[empty.length - 1]!.meta["cost"]).toBe(0);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
