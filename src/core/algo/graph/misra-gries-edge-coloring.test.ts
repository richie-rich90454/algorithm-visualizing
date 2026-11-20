import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./misra-gries-edge-coloring";

function collect(input: unknown): VisualFrame[] {
    return [...mod.run(input)];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("graph");
        expect(frame.edges).toBeInstanceOf(Array);
        expect(frame.meta).toBeTypeOf("object");
        for (const entity of frame.entities) expect(entity.type).toBe("node");
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
    });
}

function assertProper(graph: Record<string, string[]>, frame: VisualFrame): void {
    const colors = new Map<string, number>();
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])];
    const edges: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const [a, targets] of Object.entries(graph)) {
        for (const b of targets) {
            const key = [a, b].sort().join("|");
            if (a !== b && !seen.has(key)) {
                seen.add(key);
                edges.push([a, b]);
            }
        }
    }
    expect(frame.edges.length).toBe(edges.length);
    for (const edge of frame.edges) {
        expect(edge.label).not.toBe("?");
        const a = String(edge.sourceId).slice(5);
        const b = String(edge.targetId).slice(5);
        colors.set([a, b].sort().join("|"), Number(edge.label));
    }
    for (const vertex of labels) {
        const incident = new Set<number>();
        for (const [a, b] of edges) {
            if (a === vertex || b === vertex) {
                incident.add(colors.get([a, b].sort().join("|")) as number);
            }
        }
        const list = [...incident];
        expect(new Set(list).size).toBe(list.length);
    }
    const delta = Math.max(0, ...labels.map((v) => edges.filter(([a, b]) => a === v || b === v).length));
    expect(Math.max(...[...colors.values()])).toBeLessThanOrEqual(delta);
    expect(Number(frame.meta.coloredEdges)).toBe(edges.length);
    expect(Number(frame.meta.delta)).toBe(delta);
    expect(Number(frame.meta.colorsUsed)).toBeLessThanOrEqual(delta + 1);
}

describe("Misra-Gries Edge Coloring", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(200);
    });

    it("produces a proper coloring on the default input", () => {
        const graph = (mod.defaultInput as { graph: Record<string, string[]> }).graph;
        const frames = collect({ graph });
        checkFrames(frames);
        assertProper(graph, frames[frames.length - 1] as VisualFrame);
    });

    it("produces a proper coloring on random small graphs", () => {
        let seed = 334455;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 120; trial += 1) {
            const n = 2 + (next() % 5);
            const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
            const graph: Record<string, string[]> = {};
            for (const a of labels) {
                graph[a] = [];
                for (const b of labels) {
                    if (a !== b && next() % 3 === 0) graph[a]?.push(b);
                }
            }
            const frames = collect({ graph });
            checkFrames(frames);
            assertProper(graph, frames[frames.length - 1] as VisualFrame);
        }
    });

    it("colors a simple path", () => {
        const graph = { A: ["B"], B: ["A", "C"], C: ["B"] };
        const frames = collect({ graph });
        checkFrames(frames);
        assertProper(graph, frames[frames.length - 1] as VisualFrame);
    });
});
