/**
 * color-refinement.test.ts - Stability and isomorphism-invariance checks.
 */
import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import module from "./color-refinement";

function undirected(adjacency: Record<string, string[]>): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    const vertices = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    for (const vertex of vertices) graph.set(vertex, new Set());
    for (const [source, targets] of Object.entries(adjacency)) {
        for (const target of targets) {
            graph.get(source)?.add(target);
            graph.get(target)?.add(source);
        }
    }
    return graph;
}

function refine(graph: Map<string, Set<string>>, colors: number[]): number[] {
    const vertices = [...graph.keys()];
    const signatures = vertices.map((vertex, index) => {
        const neighborColors = [...(graph.get(vertex) ?? [])]
            .map((nb) => colors[vertices.indexOf(nb)] ?? 0)
            .sort((a, b) => a - b);
        return `${colors[index] ?? 0}|${neighborColors.join(",")}`;
    });
    const ids = new Map<string, number>();
    return signatures.map((signature) => {
        const known = ids.get(signature);
        if (known !== undefined) return known;
        const id = ids.size;
        ids.set(signature, id);
        return id;
    });
}

function histogram(colors: number[]): number[] {
    const counts = new Map<number, number>();
    for (const color of colors) counts.set(color, (counts.get(color) ?? 0) + 1);
    return [...counts.values()].sort((a, b) => a - b);
}

function finalColors(graph: Record<string, string[]>): number[] {
    const frames = [...module.run({ graph })];
    const last = frames[frames.length - 1];
    return (last?.meta.colors as number[] | undefined) ?? [];
}

function verifyFrameShapes(frames: VisualFrame[]): void {
    const lineCount = module.pseudocode?.length ?? 1;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lineCount);
        expect(frame.meta).toBeDefined();
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Color Refinement", () => {
    it("reaches a stable partition", () => {
        const graphs: Record<string, string[]>[] = [
            { A: ["B", "C"], B: ["A", "D"], C: ["A", "D"], D: ["B", "C"] },
            { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
            { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
        ];
        for (const graph of graphs) {
            const colors = finalColors(graph);
            const refined = refine(undirected(graph), colors);
            for (let i = 0; i < colors.length; i += 1) {
                for (let j = 0; j < colors.length; j += 1) {
                    expect((colors[i] === colors[j])).toBe(refined[i] === refined[j]);
                }
            }
        }
    });

    it("is invariant under vertex relabeling", () => {
        const base = { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] };
        const renamed = { D: ["C"], C: ["D", "B"], B: ["C", "A"], A: ["B"] };
        expect(histogram(finalColors(base))).toEqual(histogram(finalColors(renamed)));
    });

    it("distinguishes a path from a clique but not two regular lookalikes", () => {
        const path = { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] };
        const clique = { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B", "D"], D: ["A", "B", "C"] };
        const cycle6: Record<string, string[]> = {
            A: ["B", "F"], B: ["A", "C"], C: ["B", "D"],
            D: ["C", "E"], E: ["D", "F"], F: ["E", "A"],
        };
        const triangles: Record<string, string[]> = {
            A: ["B", "C"], B: ["A", "C"], C: ["A", "B"],
            D: ["E", "F"], E: ["D", "F"], F: ["D", "E"],
        };
        expect(histogram(finalColors(path))).not.toEqual(histogram(finalColors(clique)));
        expect(histogram(finalColors(cycle6))).toEqual(histogram(finalColors(triangles)));
    });

    it("terminates with sequential step numbers", () => {
        const frames = [...module.run(module.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        expect(frames[frames.length - 1]?.meta.stable).toBe(true);
        verifyFrameShapes(frames);
    });
});
